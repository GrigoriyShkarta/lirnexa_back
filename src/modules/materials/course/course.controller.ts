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
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseQueryDto } from './dto/course-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { CourseResponseDto, PaginatedCourseResponseDto } from './dto/course-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Courses')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('materials/courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Create a new course' })
  async create(@Req() req: RequestWithUser, @Body() createCourseDto: CreateCourseDto) {
    return this.courseService.create(req.user.sub, req.user.role, createCourseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses with pagination and search' })
  @ApiOkResponse({ type: PaginatedCourseResponseDto })
  async findAll(@Req() req: RequestWithUser, @Query() query: CourseQueryDto) {
    return this.courseService.get_all(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course by ID' })
  @ApiOkResponse({ type: CourseResponseDto })
  async findOne(@Param('id') id: string) {
    return this.courseService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Update a course' })
  async update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.courseService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a course' })
  async remove(@Param('id') id: string) {
    return this.courseService.remove(id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple courses' })
  async removeBulk(@Body('ids') ids: string[]) {
    return this.courseService.remove_bulk(ids);
  }
}
