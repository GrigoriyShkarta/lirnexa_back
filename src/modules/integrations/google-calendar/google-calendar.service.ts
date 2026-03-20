import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

/** Private extended property key used to mark events created by Lirnexa. */
const LIRNEXA_SOURCE_KEY = 'lirnexa_lesson_id';

/**
 * Typed representation of a personal (non-Lirnexa) Google Calendar event.
 * Events created by our sync are filtered out before returning.
 */
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: string | null;
  end: string | null;
  /** Always 'google' to distinguish from internal subscription lessons. */
  source: 'google';
  html_link: string | null;
  color_id: string | null;
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getOAuth2Client() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.error('Google OAuth credentials not configured in environment variables.');
      throw new Error('Google Calendar integration is not configured.');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  getAuthUrl(userId: string): string {
    const oauth2Client = this.getOAuth2Client();

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    // We pass userId in state to know which user the code belongs to
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Requests a refresh token
      prompt: 'consent', // Forces consent screen to always get a refresh token
      scope: scopes,
      state: userId,
    });
  }

  async handleCallback(code: string, userId: string): Promise<boolean> {
    try {
      const oauth2Client = this.getOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);

      // Save tokens to database
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          google_access_token: tokens.access_token,
          // refresh_token might not be returned if consent is not prompted, 
          // but we requested it with prompt: 'consent'
          ...(tokens.refresh_token && { google_refresh_token: tokens.refresh_token }),
        },
      });

      // Background sync of existing future events
      this.syncExistingEvents(userId).catch(e => {
        this.logger.error(`Failed to sync existing events for user ${userId}:`, e);
      });

      return true;
    } catch (error) {
      this.logger.error(`Error exchanging auth code for user ${userId}:`, error);
      throw new BadRequestException('Failed to authenticate with Google Calendar.');
    }
  }

  async getCalendarClient(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { google_access_token: true, google_refresh_token: true },
    });

    if (!user || (!user.google_access_token && !user.google_refresh_token)) {
      return null; // Not connected
    }

    const oauth2Client = this.getOAuth2Client();

    oauth2Client.setCredentials({
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token,
    });

    // Handle token refresh automatically
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        let updateData: any = { google_access_token: tokens.access_token };
        if (tokens.refresh_token) {
          updateData.google_refresh_token = tokens.refresh_token;
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: updateData,
        });
      }
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  async isConnected(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { google_refresh_token: true, google_access_token: true },
    });
    return !!(user?.google_refresh_token || user?.google_access_token);
  }

  async disconnect(userId: string): Promise<void> {
    // 1. Find all lessons with synced events for this user
    const syncedLessons = await this.prisma.subscriptionLesson.findMany({
      where: {
        subscription: {
          OR: [
            { student_id: userId },
            { super_admin_id: userId },
          ],
        },
        google_event_id: { not: null },
      },
      select: { id: true, google_event_id: true },
    });

    if (syncedLessons.length > 0) {
      this.logger.log(`Deleting ${syncedLessons.length} Google Calendar events for user ${userId} before disconnect`);
      
      // 2. Delete events from Google Calendar (parallel deletion)
      await Promise.all(
        syncedLessons.map(async (lesson) => {
          if (lesson.google_event_id) {
            try {
              await this.deleteEvent(userId, lesson.google_event_id);
            } catch (e) {
              this.logger.warn(`Failed to delete event ${lesson.google_event_id} for user ${userId}: ${e.message}`);
            }
          }
        }),
      );

      // 3. Clear google_event_id in our database for lessons
      await this.prisma.subscriptionLesson.updateMany({
        where: {
          id: { in: syncedLessons.map((l) => l.id) },
        },
        data: {
          google_event_id: null,
        },
      });
    }

    // 4. Find all personal events with synced Google IDs
    const personalEvents = await this.prisma.personalEvent.findMany({
      where: {
        user_id: userId,
        google_event_id: { not: null },
      },
      select: { id: true, google_event_id: true },
    });

    if (personalEvents.length > 0) {
      this.logger.log(`Deleting ${personalEvents.length} personal Google Calendar events for user ${userId} before disconnect`);
      
      await Promise.all(
        personalEvents.map(async (event) => {
          if (event.google_event_id) {
             try {
               await this.deleteEvent(userId, event.google_event_id);
             } catch (e) {
               this.logger.warn(`Failed to delete personal event ${event.google_event_id} for user ${userId}: ${e.message}`);
             }
          }
        })
      );
      
      await this.prisma.personalEvent.updateMany({
        where: { id: { in: personalEvents.map(p => p.id) } },
        data: { google_event_id: null }
      });
    }

    const oauth2Client = this.getOAuth2Client();
    
    // Revoke the token if we have it
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { google_access_token: true },
    });

    if (user?.google_access_token) {
       try {
           await oauth2Client.revokeToken(user.google_access_token);
       } catch (e) {
           this.logger.warn(`Could not revoke token for user ${userId}: ${e.message}`);
       }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        google_access_token: null,
        google_refresh_token: null,
      },
    });
  }

  /**
   * Private helper to handle invalid Google OAuth2 grants (revoked or expired tokens).
   * Automatically disconnects the user to prevent further errors.
   */
  private async handleInvalidGrant(userId: string, error: any): Promise<boolean> {
    const errorBody = error.response?.data?.error || '';
    const errorMessage = error.message || '';
    
    if (errorBody === 'invalid_grant' || errorMessage.includes('invalid_grant')) {
      this.logger.warn(`Google Calendar access revoked or expired for user ${userId}. Automatically disconnecting...`);
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          google_access_token: null,
          google_refresh_token: null,
        },
      });
      return true;
    }
    return false;
  }

  // --- CRUD Operations ---
  
  /**
   * Creates an event in Google Calendar only.
   * Returns Google event ID if successful.
   */
  async createEvent(userId: string, eventData: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string }[];
    lessonId?: string;
  }): Promise<string | null> {
    const calendar = await this.getCalendarClient(userId);
    if (!calendar) return null;

    try {
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: eventData.summary,
          description: eventData.description,
          start: { dateTime: eventData.startTime.toISOString() },
          end: { dateTime: eventData.endTime.toISOString() },
          attendees: eventData.attendees,
          extendedProperties: eventData.lessonId ? {
            private: { [LIRNEXA_SOURCE_KEY]: eventData.lessonId },
          } : undefined,
        },
      });

      return response.data.id || null;
    } catch (error: any) {
      if (await this.handleInvalidGrant(userId, error)) return null;
      const detail = error.response?.data?.error?.message || error.message;
      this.logger.error(`Error creating Google Calendar event for user ${userId}: ${detail}`);
      return null;
    }
  }

  /**
   * Creates a personal event: stores it locally in DB and attempts Google sync if connected.
   */
  async createPersonalEvent(userId: string, eventData: {
    summary: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    attendees?: { email: string }[];
  }): Promise<any> {
    // 1. Always create in our database first
    const personalEvent = await this.prisma.personalEvent.create({
      data: {
        summary: eventData.summary,
        description: eventData.description,
        start_time: eventData.startTime,
        end_time: eventData.endTime,
        attendees: eventData.attendees as any,
        user_id: userId,
      },
    });

    // 2. Try to sync to Google if connected
    const googleEventId = await this.createEvent(userId, eventData);
    
    if (googleEventId) {
      // Update our record with Google's ID
      await this.prisma.personalEvent.update({
        where: { id: personalEvent.id },
        data: { google_event_id: googleEventId },
      });
      
      return { ...personalEvent, google_event_id: googleEventId };
    }

    return personalEvent;
  }

  async updatePersonalEvent(userId: string, eventId: string, eventData: {
    summary?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    attendees?: { email: string }[];
  }): Promise<any> {
    // 1. Find event by either local ID or Google ID
    let existing = await this.prisma.personalEvent.findFirst({
      where: {
        OR: [
          { id: eventId },
          { google_event_id: eventId }
        ],
        user_id: userId
      },
    });

    // 2. If it exists in our DB, update it
    if (existing) {
      const updated = await this.prisma.personalEvent.update({
        where: { id: existing.id },
        data: {
          summary: eventData.summary,
          description: eventData.description,
          start_time: eventData.startTime,
          end_time: eventData.endTime,
          attendees: eventData.attendees as any,
        },
      });

      // Sync with Google if possible
      const calendar = await this.getCalendarClient(userId);
      if (calendar && updated.google_event_id) {
        try {
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: updated.google_event_id,
            requestBody: {
              summary: eventData.summary,
              description: eventData.description,
              start: eventData.startTime ? { dateTime: eventData.startTime.toISOString() } : undefined,
              end: eventData.endTime ? { dateTime: eventData.endTime.toISOString() } : undefined,
              attendees: eventData.attendees,
            },
          });
        } catch (e) {
          this.logger.error(`Error patching Google event: ${e.message}`);
        }
      }
      return updated;
    }

    // 3. If not in DB, but we have Google ID, try to update in Google directly
    const calendar = await this.getCalendarClient(userId);
    if (calendar) {
       try {
         const response = await calendar.events.patch({
           calendarId: 'primary',
           eventId: eventId,
           requestBody: {
             summary: eventData.summary,
             description: eventData.description,
             start: eventData.startTime ? { dateTime: eventData.startTime.toISOString() } : undefined,
             end: eventData.endTime ? { dateTime: eventData.endTime.toISOString() } : undefined,
             attendees: eventData.attendees,
           },
         });
         return response.data;
       } catch (e) {
         throw new BadRequestException(`Event not found or Google error: ${e.message}`);
       }
    }

    throw new BadRequestException('Event not found or access denied');
  }

  async deletePersonalEvent(userId: string, eventId: string): Promise<void> {
    // 1. Find event by local ID or Google ID
    const existing = await this.prisma.personalEvent.findFirst({
      where: {
        OR: [
          { id: eventId },
          { google_event_id: eventId }
        ],
        user_id: userId
      },
    });

    if (existing) {
      // Delete from Google if synced
      if (existing.google_event_id) {
        await this.deleteEvent(userId, existing.google_event_id);
      }
      // Delete from local DB
      await this.prisma.personalEvent.delete({
        where: { id: existing.id },
      });
      return;
    }

    // 2. If not in DB, try deleting from Google directly using the eventId provided
    const isSynced = await this.isConnected(userId);
    if (isSynced) {
       const deleted = await this.deleteEvent(userId, eventId);
       if (!deleted) {
         throw new BadRequestException('Event not found in Google Calendar');
       }
       return;
    }

    throw new BadRequestException('Event not found or access denied');
  }

  async updateEvent(userId: string, eventId: string, eventData: {
    summary?: string;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    attendees?: { email: string }[];
  }): Promise<boolean> {
    try {
      const calendar = await this.getCalendarClient(userId);
      if (!calendar) return false;

      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          ...event.data, // Preserve other properties including extendedProperties
          summary: eventData.summary ?? event.data.summary,
          description: eventData.description ?? event.data.description,
          start: eventData.startTime ? { dateTime: eventData.startTime.toISOString() } : event.data.start,
          end: eventData.endTime ? { dateTime: eventData.endTime.toISOString() } : event.data.end,
          attendees: eventData.attendees ?? event.data.attendees,
        },
      });

      return true;
    } catch (error: any) {
      if (await this.handleInvalidGrant(userId, error)) return false;
      this.logger.error(`Error updating Google Calendar event ${eventId} for user ${userId}:`, error);
      return false;
    }
  }

  async deleteEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const calendar = await this.getCalendarClient(userId);
      if (!calendar) return false;

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      return true;
    } catch (error: any) {
      if (await this.handleInvalidGrant(userId, error)) return true;
      // Ignore 404s, it's already deleted
      if (error.code !== 404) {
        this.logger.error(`Error deleting Google Calendar event ${eventId} for user ${userId}:`, error);
        return false;
      }
      return true;
    }
  }

  /**
   * Retrieves events from the user's primary Google Calendar.
   * @param userId - The ID of the authenticated user.
   * @param startDate - Optional ISO string start of the date range.
   * @param endDate - Optional ISO string end of the date range.
   * @returns Array of typed GoogleCalendarEvent objects, or empty array if not connected.
   */
  async listEvents(
    userId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<GoogleCalendarEvent[]> {
    try {
      const calendar = await this.getCalendarClient(userId);
      if (!calendar) return [];

      const timeMin = startDate ? new Date(startDate).toISOString() : undefined;
      const timeMax = endDate
        ? (() => {
            const d = new Date(endDate);
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
          })()
        : undefined;

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      const items = response.data.items ?? [];

      // Filter OUT events created by Lirnexa (identified by extendedProperties)
      // so that our lesson events are not duplicated when the frontend merges
      // them with data from our own /finance/subscriptions/calendar endpoint.
      const personalItems = items.filter(
        (item) => !item.extendedProperties?.private?.[LIRNEXA_SOURCE_KEY],
      );

      return personalItems.map((item): GoogleCalendarEvent => ({
        id: item.id ?? '',
        summary: item.summary ?? '(no title)',
        description: item.description ?? null,
        start: item.start?.dateTime ?? item.start?.date ?? null,
        end: item.end?.dateTime ?? item.end?.date ?? null,
        source: 'google',
        html_link: item.htmlLink ?? null,
        color_id: item.colorId ?? null,
      }));
    } catch (error: any) {
      if (await this.handleInvalidGrant(userId, error)) return [];
      this.logger.error(`Error listing Google Calendar events for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Syncs existing subscription lessons that are scheduled in the future
   * but don't yet have a google_event_id.
   */
  async syncExistingEvents(userId: string) {
    try {
      const isConnected = await this.isConnected(userId);
      if (!isConnected) return;

      const now = new Date();

      const lessons = await this.prisma.subscriptionLesson.findMany({
        where: {
          subscription: {
            OR: [
              { student_id: userId },
              { super_admin_id: userId }
            ]
          },
          date: { gte: now },
          status: { in: ['scheduled', 'rescheduled'] },
          google_event_id: null
        },
        include: {
          subscription: {
            include: { student: true, subscription: true }
          }
        }
      });

      for (const lesson of lessons) {
        if (!lesson.date) continue;
        
        try {
          const summary = `${lesson.subscription.subscription?.name || lesson.subscription.name || 'Lesson'} - ${lesson.subscription.student.name}`;
          const safeStartTime = lesson.date as Date;
          const safeEndTime = new Date(safeStartTime.getTime() + 60 * 60 * 1000); // 1 hour duration assumption

          const attendees = lesson.subscription.student.email ? [{ email: lesson.subscription.student.email }] : [];

          const eventId = await this.createEvent(userId, {
              summary,
              startTime: safeStartTime,
              endTime: safeEndTime,
              lessonId: lesson.id,
              attendees,
          });

          await this.prisma.subscriptionLesson.update({
              where: { id: lesson.id },
              data: { google_event_id: eventId },
          });
        } catch (e: any) {
          if (await this.handleInvalidGrant(userId, e)) return;
          this.logger.error(`Failed to sync lesson ${lesson.id} for user ${userId}: ${e.message}`);
          // Continue to next lesson
        }
      }
      this.logger.log(`Successfully synced ${lessons.length} existing future events for user ${userId}`);
    } catch (e: any) {
       if (await this.handleInvalidGrant(userId, e)) return;
       this.logger.error(`Error syncing existing events for user ${userId}:`, e);
    }
  }
}
