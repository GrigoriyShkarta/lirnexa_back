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
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonQueryDto } from './dto/lesson-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { LessonResponseDto, PaginatedLessonResponseDto } from './dto/lesson-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Lessons')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('materials/lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Create a new lesson' })
  async create(@Req() req: RequestWithUser, @Body() createLessonDto: CreateLessonDto) {
    return this.lessonService.create(req.user.sub, req.user.role, createLessonDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all lessons with pagination and search' })
  @ApiOkResponse({ type: PaginatedLessonResponseDto })
  async findAll(@Req() req: RequestWithUser, @Query() query: LessonQueryDto) {
    return this.lessonService.get_all(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lesson by ID' })
  @ApiOkResponse({ type: LessonResponseDto })
  async findOne(@Param('id') id: string) {
    return this.lessonService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update a lesson' })
  async update(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonService.update(id, updateLessonDto);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a lesson' })
  async remove(@Param('id') id: string) {
    return this.lessonService.remove(id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple lessons' })
  async removeBulk(@Body('ids') ids: string[]) {
    return this.lessonService.remove_bulk(ids);
  }
}
