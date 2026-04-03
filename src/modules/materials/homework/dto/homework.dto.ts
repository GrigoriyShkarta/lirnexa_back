import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsArray, IsOptional, IsUUID, IsInt, Min, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateHomeworkDto {
  @ApiProperty({ description: 'The title of the homework' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ 
    description: 'The content (blocks) of the homework', 
    type: 'array', 
    items: { type: 'object' },
    example: [] 
  })
  @IsArray()
  @IsOptional()
  content?: any[];

  @ApiPropertyOptional({ description: 'The lesson ID this homework belongs to', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.lesson_id !== null && o.lesson_id !== undefined && o.lesson_id !== '')
  @IsUUID()
  lesson_id?: string | null;

  @ApiPropertyOptional({ description: 'Category IDs to associate with this homework', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  category_ids?: string[];
}

export class UpdateHomeworkDto {
  @ApiPropertyOptional({ description: 'The title of the homework' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ 
    description: 'The content (blocks) of the homework',
    type: 'array',
    items: { type: 'object' },
    example: []
  })
  @IsArray()
  @IsOptional()
  content?: any[];

  @ApiPropertyOptional({ description: 'Category IDs to associate with this homework', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'The lesson ID this homework belongs to', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.lesson_id !== null && o.lesson_id !== undefined && o.lesson_id !== '')
  @IsUUID()
  lesson_id?: string | null;
}

export class SubmitHomeworkDto {
  @ApiPropertyOptional({ description: 'Text message for the submission' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'URLs of uploaded files', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  file_urls?: string[];
}

export class ReviewHomeworkDto {
  @ApiPropertyOptional({ description: 'Teacher feedback' })
  @IsString()
  @IsOptional()
  feedback?: string;

  @ApiProperty({ description: 'Whether the homework was reviewed', enum: ['reviewed'] })
  @IsString()
  @IsNotEmpty()
  status: 'reviewed';
}

export class HomeworkQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, description: 'Items per page' })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Search term', description: 'Search by name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: ['uuid-1', 'uuid-2'], description: 'Filter by category IDs' })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value || obj['category_ids[]'];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val;
    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Filter materials that student has access to' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  from_student?: boolean;

  @ApiPropertyOptional({ description: 'Specific student ID to check access for' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ description: 'Filter by lesson ID' })
  @IsOptional()
  @IsString()
  lesson_id?: string;

  @ApiPropertyOptional({ description: 'Filter by a single submission status', example: 'pending' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by multiple submission statuses', type: [String], example: ['pending'] })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value || obj['statuses[]'];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val;
    return undefined;
  })
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];
}
