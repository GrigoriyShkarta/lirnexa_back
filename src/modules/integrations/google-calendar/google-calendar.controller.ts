import { Controller, Get, Post, Delete, Req, Res, UseGuards, Query, Body, BadRequestException, Patch, Param } from '@nestjs/common';
import { GoogleCalendarService, GoogleCalendarEvent } from './google-calendar.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CreatePersonalEventDto } from './dto/create-personal-event.dto';
import { UpdatePersonalEventDto } from './dto/update-personal-event.dto';

/**
 * Handles OAuth callback logic shared between both callback controllers.
 * @param service - The Google Calendar service.
 * @param code - Authorization code from Google.
 * @param state - Encoded state param (userId:locale).
 * @param res - Express response.
 */
async function processOAuthCallback(
  service: GoogleCalendarService,
  code: string,
  state: string,
  res: Response,
): Promise<void> {
  if (!code || !state) {
    res.status(400).send('Missing code or state in callback.');
    return;
  }

  // State is encoded as 'userId:locale' to carry both across the OAuth flow
  const separatorIndex = state.indexOf(':');
  const userId = separatorIndex !== -1 ? state.substring(0, separatorIndex) : state;
  const locale = separatorIndex !== -1 ? state.substring(separatorIndex + 1) : '';

  await service.handleCallback(code, userId);

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const localePath = locale ? `/${locale}` : '';
  res.redirect(`${frontendUrl}${localePath}/main/calendar?calendar_synced=true`);
}

@ApiTags('Google Calendar')
@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('auth-url')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get the URL to authenticate with Google Calendar' })
  async getAuthUrl(@Req() req: RequestWithUser, @Query('locale') locale?: string) {
    // Encode userId and locale together in state so the callback can use both
    const state = locale ? `${req.user.sub}:${locale}` : req.user.sub;
    const url = this.googleCalendarService.getAuthUrl(state);
    return { url };
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Check if the user has connected their Google Calendar' })
  async checkStatus(@Req() req: RequestWithUser) {
    const isConnected = await this.googleCalendarService.isConnected(req.user.sub);
    return { isConnected };
  }

  @Delete('disconnect')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Disconnect the user's Google Calendar" })
  async disconnect(@Req() req: RequestWithUser) {
    await this.googleCalendarService.disconnect(req.user.sub);
    return { message: 'Successfully disconnected.' };
  }

  @Post('events')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a personal event in Google Calendar' })
  @ApiBody({ type: CreatePersonalEventDto })
  async createPersonalEvent(@Req() req: RequestWithUser, @Body() dto: CreatePersonalEventDto) {
    const result = await this.googleCalendarService.createPersonalEvent(req.user.sub, {
      summary: dto.summary,
      description: dto.description,
      startTime: new Date(dto.start_time),
      endTime: new Date(dto.end_time),
      attendees: dto.attendees,
    });

    return { 
      data: result,
      message: 'Event created successfully' 
    };
  }

  @Patch('events/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Update a personal event' })
  @ApiBody({ type: UpdatePersonalEventDto })
  async updatePersonalEvent(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdatePersonalEventDto,
  ) {
    const result = await this.googleCalendarService.updatePersonalEvent(req.user.sub, id, {
      summary: dto.summary,
      description: dto.description,
      startTime: dto.start_time ? new Date(dto.start_time) : undefined,
      endTime: dto.end_time ? new Date(dto.end_time) : undefined,
      attendees: dto.attendees,
    });

    return {
      data: result,
      message: 'Event updated successfully',
    };
  }

  @Delete('events/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Delete a personal event' })
  async deletePersonalEvent(@Req() req: RequestWithUser, @Param('id') id: string) {
    await this.googleCalendarService.deletePersonalEvent(req.user.sub, id);
    return { message: 'Event deleted successfully' };
  }


  @Get('events')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: "Get events from the user's Google Calendar" })
  @ApiQuery({ name: 'start_date', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'end_date', required: false, example: '2024-01-31' })
  async getEvents(
    @Req() req: RequestWithUser,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.googleCalendarService.listEvents(req.user.sub, start_date, end_date);
  }

  @Post('sync-existing')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Manually trigger syncing of existing schedule into Google Calendar' })
  async syncExisting(@Req() req: RequestWithUser) {
    // We start this in the background to not block the response
    this.googleCalendarService.syncExistingEvents(req.user.sub).catch((_err) => {
      // Error is already logged inside syncExistingEvents
    });
    return { message: 'Sync started successfully' };
  }

  @Get('callback')
  @ApiOperation({ summary: 'Callback for Google OAuth flow (via /google-calendar/callback)' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return processOAuthCallback(this.googleCalendarService, code, state, res);
  }

  /**
   * Returns only personal (non-Lirnexa) events from the user's Google Calendar.
   * Lirnexa-created lesson events are filtered out automatically on the backend.
   * The frontend should merge the result of this endpoint with data from
   * GET /finance/subscriptions/calendar to build a unified calendar view.
   *
   * @param start_date - ISO date string (e.g. 2026-03-01)
   * @param end_date   - ISO date string (e.g. 2026-03-31)
   */
  @Get('personal-events')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get personal Google Calendar events (excluding Lirnexa lesson events)' })
  @ApiOkResponse({ description: 'Array of personal Google Calendar events.' })
  async getPersonalEvents(
    @Req() req: RequestWithUser,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ): Promise<GoogleCalendarEvent[]> {
    return this.googleCalendarService.listEvents(req.user.sub, start_date, end_date);
  }
}

/**
 * Separate controller to handle the Google OAuth callback at /auth/google/callback.
 * This matches the redirect URI registered in Google Cloud Console.
 */
@ApiTags('Google Calendar')
@Controller('auth/google')
export class GoogleOAuthCallbackController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('callback')
  @ApiOperation({ summary: 'Callback for Google OAuth flow (via /auth/google/callback)' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    return processOAuthCallback(this.googleCalendarService, code, state, res);
  }
}
