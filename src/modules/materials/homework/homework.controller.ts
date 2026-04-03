import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HomeworkService } from './homework.service';
import { Role } from '@prisma/client';
import { CreateHomeworkDto, UpdateHomeworkDto, SubmitHomeworkDto, ReviewHomeworkDto, HomeworkQueryDto } from './dto/homework.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';
import { 
  HomeworkResponseDto, 
  PaginatedHomeworkResponseDto, 
  HomeworkSubmissionResponseDto 
} from './dto/homework-response.dto';

@ApiTags('Materials - Homework')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('materials/homeworks')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Get()
  @ApiOperation({ summary: 'Get all homeworks with pagination and search' })
  @ApiOkResponse({ type: PaginatedHomeworkResponseDto })
  async get_all(@Req() req: RequestWithUser, @Query() query: HomeworkQueryDto) {
    return this.homeworkService.get_all(req.user.sub, req.user.role, query);
  }

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Create a new homework for a lesson' })
  @ApiOkResponse({ type: HomeworkResponseDto })
  async create(@Body() dto: CreateHomeworkDto, @Req() req: RequestWithUser) {
    return this.homeworkService.create(dto, req.user.sub, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update homework content' })
  @ApiOkResponse({ type: HomeworkResponseDto })
  async update(@Param('id') id: string, @Body() dto: UpdateHomeworkDto, @Req() req: RequestWithUser) {
    return this.homeworkService.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a homework' })
  @ApiOkResponse({ description: 'Deleted' })
  async delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.delete(id, req.user.sub, req.user.role);
  }

  @Get('lesson/:lesson_id')
  @ApiOperation({ summary: 'Get homework by lesson ID' })
  @ApiOkResponse({ type: HomeworkResponseDto })
  async find_by_lesson(@Param('lesson_id') lesson_id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.find_by_lesson(lesson_id, req.user.sub, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single homework by ID' })
  @ApiOkResponse({ type: HomeworkResponseDto })
  async find_by_id(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.find_by_id(id, req.user.sub, req.user.role);
  }

  @Post(':id/submit')
  @Roles(Role.student)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit homework as a student' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        file_urls: { type: 'array', items: { type: 'string' } },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOkResponse({ type: HomeworkSubmissionResponseDto })
  async submit(
    @Param('id') id: string,
    @Body() dto: SubmitHomeworkDto,
    @Req() req: RequestWithUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.homeworkService.submit(id, dto, req.user.sub, files);
  }

  @Get(':id/submissions')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Get all submissions for a homework' })
  @ApiOkResponse({ type: [HomeworkSubmissionResponseDto] })
  async get_submissions(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.get_submissions(id, req.user.sub, req.user.role);
  }

  @Get('submissions/my')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Get my current submission for a homework by query param' })
  @ApiOkResponse({ type: HomeworkSubmissionResponseDto })
  async get_my_submission_by_query(@Query('homework_id') homework_id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.get_my_submission(homework_id, req.user.sub);
  }

  @Get(':id/my-submission')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Get my current submission for a homework' })
  @ApiOkResponse({ type: HomeworkSubmissionResponseDto })
  async get_my_submission(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.homeworkService.get_my_submission(id, req.user.sub);
  }

  @Patch('submission/:id/review')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Review and grade a homework submission' })
  @ApiOkResponse({ type: HomeworkSubmissionResponseDto })
  async review_submission(
    @Param('id') id: string,
    @Body() dto: ReviewHomeworkDto,
    @Req() req: RequestWithUser,
  ) {
    return this.homeworkService.review_submission(id, dto, req.user.sub, req.user.role);
  }
}
