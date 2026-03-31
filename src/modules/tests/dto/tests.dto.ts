import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsArray,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TestSettingsDto {
  @ApiProperty({ description: 'Passing score (percentage or absolute)', example: 0 })
  @IsInt()
  passing_score: number;

  @ApiPropertyOptional({ description: 'Time limit in minutes', example: null })
  @IsOptional()
  @IsInt()
  time_limit?: number | null;
}

export class CreateTestDto {
  @ApiProperty({ description: 'Title of the test', example: 'Final Exam' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Test description', example: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'List of category IDs', type: [String], example: [] })
  @IsArray()
  @IsUUID('all', { each: true })
  category_ids: string[];

  @ApiPropertyOptional({ description: 'List of course IDs to add this test to', type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  course_ids?: string[];

  @ApiProperty({ description: 'Test configuration', type: TestSettingsDto })
  @ValidateNested()
  @Type(() => TestSettingsDto)
  settings: TestSettingsDto;

  @ApiProperty({ description: 'JSON structure of questions (as array of objects)', example: '[]' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
  })
  @IsArray()
  @IsObject({ each: true })
  // any used here because questions can have different structures based on type
  content: any[];
}

export class UpdateTestDto {
  @ApiPropertyOptional({ description: 'Title of the test', example: 'Final Exam' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Test description', example: '' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'List of category IDs', type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'List of course IDs to add this test to', type: [String], example: [] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  course_ids?: string[];

  @ApiPropertyOptional({ description: 'Test configuration', type: TestSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TestSettingsDto)
  settings?: TestSettingsDto;

  @ApiPropertyOptional({ description: 'JSON structure of questions (as array of objects)', example: '[]' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch (e) { return value; }
    }
    return value;
  })
  @IsArray()
  @IsObject({ each: true })
  content?: any[];
}

export class SubmitAttemptDto {
  @ApiProperty({ description: 'Student answers to questions', example: [] })
  @IsArray()
  @IsObject({ each: true })
  answers: Record<string, any>[];

  @ApiProperty({ description: 'Time spent in seconds', example: 120 })
  @IsInt()
  time_spent: number;
}

export class ReviewAnswerDto {
  @ApiProperty({ description: 'Points awarded by teacher' })
  @IsInt()
  points_awarded: number;

  @ApiPropertyOptional({ description: 'Teacher optional feedback' })
  @IsOptional()
  @IsString()
  teacher_comment?: string;
}

export class AttemptResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() test_id: string;
  @ApiProperty() student_id: string;
  @ApiProperty() score: number | null;
  @ApiProperty() total_points: number | null;
  @ApiProperty() time_spent: number;
  @ApiProperty() is_passed: boolean;
  @ApiProperty() answers: any;
  @ApiProperty() status: string;
  @ApiProperty() started_at: Date;
  @ApiPropertyOptional() completed_at: Date | null;
  @ApiProperty() created_at: Date;
}

export class TestResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty({ type: TestSettingsDto }) settings: any;
  @ApiProperty() content: any;
  @ApiProperty() author_id: string;
  @ApiPropertyOptional() super_admin_id?: string;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;

  @ApiPropertyOptional({ description: 'Indicates if the student has passed the test' })
  is_passed?: boolean;

  @ApiPropertyOptional({ description: 'The last attempt of the student', type: AttemptResponseDto })
  last_attempt?: AttemptResponseDto;

  @ApiPropertyOptional()
  title?: string;
}
