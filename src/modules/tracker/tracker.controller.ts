import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { TrackerService } from './tracker.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { 
  CreateColumnDto, 
  CreateTaskDto, 
  UpdateColumnDto, 
  UpdateTaskDto, 
  TrackerBoardResponse, 
  CreateSubtaskDto
} from './dto/tracker.dto';

@ApiTags('Tracker')
@UseGuards(AuthGuard)
@Controller('tracker')
export class TrackerController {
  constructor(private readonly tracker_service: TrackerService) {}

  @Get(':student_id')
  @ApiOperation({ summary: 'Get tracker board for a student' })
  @ApiResponse({ type: TrackerBoardResponse })
  async get_board(
    @Param('student_id') student_id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.get_board(student_id, req.user.sub, req.user.role);
  }

  @Post(':student_id/columns')
  @ApiOperation({ summary: 'Create a new column' })
  async create_column(
    @Param('student_id') student_id: string,
    @Body() dto: CreateColumnDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.create_column(student_id, req.user.sub, req.user.role, dto);
  }

  @Patch('columns/:column_id')
  @ApiOperation({ summary: 'Update a column' })
  async update_column(
    @Param('column_id') column_id: string,
    @Body() dto: UpdateColumnDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.update_column(column_id, req.user.sub, req.user.role, dto);
  }

  @Delete('columns/:column_id')
  @ApiOperation({ summary: 'Delete a column' })
  async delete_column(
    @Param('column_id') column_id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.delete_column(column_id, req.user.sub, req.user.role);
  }

  @Post(':student_id/tasks')
  @ApiOperation({ summary: 'Create a new task' })
  async create_task(
    @Param('student_id') student_id: string,
    @Body() dto: CreateTaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.create_task(student_id, req.user.sub, req.user.role, dto);
  }

  @Patch('tasks/:task_id')
  @ApiOperation({ summary: 'Update a task' })
  async update_task(
    @Param('task_id') task_id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.update_task(task_id, req.user.sub, req.user.role, dto);
  }

  @Delete('tasks/:task_id')
  @ApiOperation({ summary: 'Delete a task' })
  async delete_task(
    @Param('task_id') task_id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.delete_task(task_id, req.user.sub, req.user.role);
  }

  @Post('tasks/:task_id/subtasks')
  @ApiOperation({ summary: 'Create a subtask' })
  async create_subtask(
    @Param('task_id') task_id: string,
    @Body() dto: CreateSubtaskDto,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.create_subtask(task_id, req.user.sub, req.user.role, dto);
  }

  @Patch('subtasks/:subtask_id/toggle')
  @ApiOperation({ summary: 'Toggle subtask completion' })
  async toggle_subtask(
    @Param('subtask_id') subtask_id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.toggle_subtask(subtask_id, req.user.sub, req.user.role);
  }

  @Delete('subtasks/:subtask_id')
  @ApiOperation({ summary: 'Delete a subtask' })
  async delete_subtask(
    @Param('subtask_id') subtask_id: string,
    @Req() req: RequestWithUser,
  ) {
    return this.tracker_service.delete_subtask(subtask_id, req.user.sub, req.user.role);
  }
}
