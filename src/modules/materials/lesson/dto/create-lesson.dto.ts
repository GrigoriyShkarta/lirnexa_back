import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'My Awesome Lesson', description: 'Name of the lesson' })
  @IsString()
  @IsNotEmpty({ message: 'lesson_name_required' })
  name: string;

  @ApiProperty({ example: 'https://...', description: 'Cover image URL' })
  @IsString()
  @IsOptional()
  cover_url?: string;

  @ApiProperty({ example: 100, description: 'Cover image position' })
  @IsNumber()
  @IsOptional()
  cover_position?: number;

  @ApiProperty({ example: '[]', description: 'Lesson content in JSON blocks' })
  @IsString()
  @IsNotEmpty({ message: 'lesson_content_required' })
  content: string;

  @ApiProperty({ example: 45, description: 'Duration in minutes', required: false })
  @IsNumber()
  @IsOptional()
  duration?: number;

  @ApiProperty({ example: 'uuid', description: 'Category ID' })
  @IsString()
  @IsOptional()
  category_id?: string;

  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'Category IDs' })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return value;
  })
  @IsArray({ message: 'categories_must_be_an_array' })
  @IsString({ each: true })
  @IsOptional()
  category_ids?: string[];

  @ApiProperty({ example: ['course-uuid-1'], description: 'Course IDs to add this lesson to' })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  course_ids?: string[];
}
