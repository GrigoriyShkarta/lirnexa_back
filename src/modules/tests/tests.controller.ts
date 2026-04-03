import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TestsService } from './tests.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import {
  CreateTestDto,
  UpdateTestDto,
  SubmitAttemptDto,
  ReviewAnswerDto,
  TestResponseDto,
  AttemptResponseDto,
} from './dto/tests.dto';
import { TestQueryDto } from './dto/test-query.dto';

@ApiTags('Tests')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('tests')
export class TestsController {
  constructor(private readonly tests_service: TestsService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Tests Management (Admin/Teacher mostly, but Students can view)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new test.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new test' })
  @ApiResponse({ status: 201, type: TestResponseDto })
  async create(
    @Body() dto: CreateTestDto,
    @Req() req: RequestWithUser,
  ): Promise<TestResponseDto> {
    return this.tests_service.create(dto, req.user.sub, req.user.role);
  }

  @Get()
  @ApiOperation({ summary: 'Get all available tests with pagination and filtering' })
  @ApiResponse({ status: 200 })
  async find_all(
    @Req() req: RequestWithUser,
    @Query() query: TestQueryDto,
  ) {
    return this.tests_service.find_all(req.user.sub, req.user.role, query);
  }

  /**
   * Returns a single test by ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single test by ID' })
  @ApiParam({ name: 'id', description: 'Test UUID' })
  @ApiResponse({ status: 200, type: TestResponseDto })
  async find_one(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<TestResponseDto> {
    return this.tests_service.find_one(id, req.user.sub, req.user.role);
  }

  /**
   * Updates test metadata or questions.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update test content or settings' })
  @ApiParam({ name: 'id', description: 'Test UUID' })
  @ApiResponse({ status: 200, type: TestResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTestDto,
    @Req() req: RequestWithUser,
  ): Promise<TestResponseDto> {
    return this.tests_service.update(id, dto, req.user.sub, req.user.role);
  }

  /**
   * Deletes a test.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a test' })
  @ApiParam({ name: 'id', description: 'Test UUID' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  async delete(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    return this.tests_service.delete(id, req.user.sub, req.user.role);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Student Attempts logic
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new attempt record and returns it.
   */
  @Post(':id/start')
  @ApiOperation({ summary: 'Start a new test attempt (Student)' })
  @ApiParam({ name: 'id', description: 'Test UUID' })
  @ApiResponse({ status: 201, type: AttemptResponseDto })
  async start_attempt(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<AttemptResponseDto> {
    return this.tests_service.start_attempt(id, req.user.sub, req.user.role);
  }

  /**
   * Submits answers and evaluates score.
   */
  @Post('attempts/:attempt_id/submit')
  @ApiOperation({ summary: 'Submit answers and complete the test attempt' })
  @ApiParam({ name: 'attempt_id', description: 'Attempt UUID' })
  @ApiResponse({ status: 200, type: AttemptResponseDto })
  async submit_attempt(
    @Param('attempt_id') attempt_id: string,
    @Body() dto: SubmitAttemptDto,
    @Req() req: RequestWithUser,
  ): Promise<AttemptResponseDto> {
    return this.tests_service.submit_attempt(attempt_id, dto, req.user.sub);
  }

  /**
   * Returns attempt history for the logged-in student.
   */
  @Get('student/attempts')
  @ApiOperation({ summary: 'Get current student attempt history' })
  @ApiResponse({ status: 200, type: [AttemptResponseDto] })
  async get_my_attempts(
    @Req() req: RequestWithUser,
    @Query('test_id') test_id?: string,
  ): Promise<AttemptResponseDto[]> {
    return this.tests_service.find_attempts(req.user.sub, test_id);
  }

  /**
   * Returns count of all pending reviews.
   */
  @Get('admin/attempts/pending-count')
  @ApiOperation({ summary: 'Get total count of attempts awaiting review' })
  async get_pending_reviews_count(@Req() req: RequestWithUser): Promise<{ count: number }> {
    const count = await this.tests_service.get_pending_review_count(req.user.sub, req.user.role);
    return { count };
  }

  /**
   * Returns all attempts across all tests (Admin/Teacher only).
   */
  @Get('admin/attempts')
  @ApiOperation({ summary: 'Get all student attempts across all tests (Admin/Teacher only)' })
  @ApiResponse({ status: 200, type: [AttemptResponseDto] })
  async get_all_attempts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<{ data: AttemptResponseDto[], meta: any }> {
    return this.tests_service.find_attempts_paginated(undefined, page, limit, status);
  }

  /**
   * Returns all attempts for a test (for statistics).
   */
  @Get('admin/test/:test_id/attempts')
  @ApiOperation({ summary: 'Get all student attempts for a specific test (Admin/Teacher only)' })
  @ApiParam({ name: 'test_id', description: 'Test UUID' })
  @ApiResponse({ status: 200, type: [AttemptResponseDto] })
  async get_test_attempts(
    @Param('test_id') test_id: string,
    @Req() req: RequestWithUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ): Promise<{ data: AttemptResponseDto[], meta: any }> {
    return this.tests_service.find_attempts_paginated(test_id, page, limit, status);
  }

  /**
   * Returns a single attempt by ID.
   */
  @Get('attempts/:id')
  @ApiOperation({ summary: 'Get a single test attempt details' })
  @ApiParam({ name: 'id', description: 'Attempt UUID' })
  @ApiResponse({ status: 200, type: AttemptResponseDto })
  async find_attempt_one(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<AttemptResponseDto> {
    return this.tests_service.find_attempt_one(id, req.user.sub, req.user.role);
  }

  /**
   * Reviews a specific answer within an attempt (Admin/Teacher only).
   */
  @Patch('attempts/:attempt_id/answers/:answer_id/review')
  @ApiOperation({ summary: 'Grade a student answer (Admin/Teacher only)' })
  @ApiParam({ name: 'attempt_id', description: 'Attempt UUID' })
  @ApiParam({ name: 'answer_id', description: 'Answer UUID (matches question_id usually)' })
  @ApiResponse({ status: 200, type: AttemptResponseDto })
  async review_answer(
    @Param('attempt_id') attempt_id: string,
    @Param('answer_id') answer_id: string,
    @Body() dto: ReviewAnswerDto,
    @Req() req: RequestWithUser,
  ): Promise<AttemptResponseDto> {
    return this.tests_service.review_answer(attempt_id, answer_id, dto, req.user.sub, req.user.role);
  }

  /**
   * Returns total statistics across all tests in the space.
   */
  @Get('admin/stats')
  @ApiOperation({ summary: 'Get global test statistics (Admin/Teacher only)' })
  async get_global_stats(
    @Req() req: RequestWithUser,
  ): Promise<any> {
    return this.tests_service.get_test_stats(req.user.sub, req.user.role);
  }

  /**
   * Returns test statistics for admin.
   */
  @Get('admin/test/:test_id/stats')
  @ApiOperation({ summary: 'Get test overall statistics (Admin/Teacher only)' })
  @ApiParam({ name: 'test_id', description: 'Test UUID' })
  async get_test_stats(
    @Param('test_id') test_id: string,
    @Req() req: RequestWithUser,
  ): Promise<any> {
    return this.tests_service.get_test_stats(req.user.sub, req.user.role, test_id);
  }
}
