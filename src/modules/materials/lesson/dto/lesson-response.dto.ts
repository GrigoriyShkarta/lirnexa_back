import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CategoryResponseDto } from '../../../category/dto/category-response.dto';
import { HomeworkResponseDto } from '../../homework/dto/homework-response.dto';

export class LessonAuthorResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ required: false })
  avatar?: string;
}

export class LessonCourseResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
}

export class PaginationMetaDto {
  @ApiProperty()
  total: number;
  @ApiProperty()
  page: number;
  @ApiProperty()
  limit: number;
  @ApiProperty()
  total_pages: number;
}

/**
 * Lesson response data with relations and access info
 */
export class LessonResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  cover_url?: string;

  @ApiProperty()
  cover_position: number;

  @ApiProperty({ default: false })
  is_copying_disabled: boolean;

  @ApiProperty({ default: true })
  add_files_to_materials: boolean;

  @ApiProperty()
  content: any;

  @ApiProperty()
  author_id: string;

  @ApiProperty({ required: false })
  duration?: number;

  @ApiProperty({ type: () => LessonAuthorResponseDto })
  author: LessonAuthorResponseDto;

  @ApiProperty({ type: () => [CategoryResponseDto], required: false })
  categories?: CategoryResponseDto[];

  @ApiProperty({ type: () => [LessonCourseResponseDto], required: false })
  courses?: LessonCourseResponseDto[];

  @ApiProperty({ type: () => HomeworkResponseDto, required: false })
  homework?: HomeworkResponseDto;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ type: [String], description: 'List of block IDs accessible to the specified student', required: false })
  accessible_blocks?: string[];

  @IsOptional()
  @ApiProperty({ description: 'Whether the specified student has full access to the lesson', required: false })
  full_access?: boolean;

  @ApiProperty({ type: [String], description: 'List of student IDs who have access to this lesson', required: false })
  @IsOptional()
  accessible_student_ids?: string[];

  @ApiProperty({ description: 'Whether the specified student has access to the lesson', required: false })
  @IsOptional()
  has_access?: boolean;

  @ApiProperty({ description: 'Homework submission status for the student', required: false, example: 'not_submitted' })
  @IsOptional()
  homework_status?: string;
}

export class PaginatedLessonResponseDto {
  @ApiProperty({ type: [LessonResponseDto] })
  data: LessonResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}
