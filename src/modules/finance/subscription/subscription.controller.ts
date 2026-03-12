import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { CreateStudentSubscriptionDto } from './dto/create-student-subscription.dto';
import { UpdateStudentSubscriptionDto } from './dto/update-student-subscription.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

import {
  SubscriptionTemplateResponseDto,
  PaginatedSubscriptionTemplateResponseDto,
  StudentSubscriptionResponseDto,
  SubscriptionLessonResponseDto,
  PaymentTransactionResponseDto,
} from './dto/subscription.response';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('finance/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Create a new subscription template' })
  @ApiOkResponse({ type: SubscriptionTemplateResponseDto })
  async create(@Req() req: RequestWithUser, @Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionService.create(req.user.sub, req.user.role, createSubscriptionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all subscription templates' })
  @ApiOkResponse({ type: PaginatedSubscriptionTemplateResponseDto })
  async findAll(@Req() req: RequestWithUser, @Query() query: SubscriptionQueryDto) {
    return this.subscriptionService.get_all(req.user.sub, query);
  }

  @Get('transactions')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Get all payment transactions for the space' })
  @ApiOkResponse({ type: [PaymentTransactionResponseDto] })
  async getTransactions(@Req() req: RequestWithUser, @Query() query: TransactionQueryDto) {
    return this.subscriptionService.getAllTransactions(req.user.sub, req.user.role, query);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get subscription lessons for calendar view' })
  @ApiOkResponse({ type: [SubscriptionLessonResponseDto] })
  async getCalendar(@Req() req: RequestWithUser, @Query() query: CalendarQueryDto) {
    return this.subscriptionService.getCalendar(req.user.sub, req.user.role, query);
  }

  @Get('transactions/subscription/:id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Get all transactions for a specific student subscription' })
  @ApiOkResponse({ type: [PaymentTransactionResponseDto] })
  async getSubscriptionTransactions(@Param('id') id: string) {
    return this.subscriptionService.getSubscriptionTransactions(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a subscription template by ID' })
  @ApiOkResponse({ type: SubscriptionTemplateResponseDto })
  async findOne(@Param('id') id: string) {
    return this.subscriptionService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update a subscription template' })
  @ApiOkResponse({ type: SubscriptionTemplateResponseDto })
  async update(@Param('id') id: string, @Body() updateSubscriptionDto: UpdateSubscriptionDto) {
    return this.subscriptionService.update(id, updateSubscriptionDto);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a subscription template' })
  async remove(@Param('id') id: string) {
    return this.subscriptionService.remove(id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple subscription templates' })
  async removeBulk(@Body('ids') ids: string[]) {
    return this.subscriptionService.remove_bulk(ids);
  }

  // --- Student Subscriptions ---

  @Post('assign')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Assign a subscription to a student' })
  @ApiOkResponse({ type: StudentSubscriptionResponseDto })
  async assignToStudent(@Body() dto: CreateStudentSubscriptionDto) {
    return this.subscriptionService.assignToStudent(dto);
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get all subscriptions for a student' })
  @ApiOkResponse({ type: [StudentSubscriptionResponseDto] })
  async getStudentSubscriptions(@Param('studentId') studentId: string) {
    return this.subscriptionService.getStudentSubscriptions(studentId);
  }

  @Patch('student/:id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update student subscription (payment status, amount, etc.)' })
  @ApiOkResponse({ type: StudentSubscriptionResponseDto })
  async updateStudentSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateStudentSubscriptionDto,
  ) {
    return this.subscriptionService.updateStudentSubscription(id, dto);
  }

  @Patch('lesson/:lessonId')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update status or date of a specific lesson in a subscription' })
  @ApiOkResponse({ type: SubscriptionLessonResponseDto })
  async updateLessonStatus(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonStatusDto,
  ) {
    return this.subscriptionService.updateLessonStatus(lessonId, dto);
  }

  @Delete('student/:id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Remove a single subscription from a student' })
  async removeStudentSubscription(@Param('id') id: string) {
    return this.subscriptionService.removeStudentSubscription(id);
  }

  @Delete('student')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Remove multiple student subscriptions' })
  async removeStudentSubscriptionsBulk(@Body('ids') ids: string[]) {
    return this.subscriptionService.removeStudentSubscriptionsBulk(ids);
  }

  @Get('student-all')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Get all student subscriptions for the space' })
  async getAllStudentSubscriptions(@Req() req: RequestWithUser) {
    return this.subscriptionService.getAllStudentSubscriptions(req.user.sub, req.user.role);
  }
}
