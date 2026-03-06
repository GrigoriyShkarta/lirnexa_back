import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class LessonQueryDto {
  @ApiPropertyOptional({ description: 'Search by name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: ['uuid-1', 'uuid-2'], description: 'Filter by category IDs' })
  @IsOptional()
  @Transform(({ value, obj }) => {
    const val = value || obj['category_ids[]'];
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val;
    return undefined;
  })
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Filter lessons that student has access to' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  from_student?: boolean;

  @ApiPropertyOptional({ description: 'Specific student ID to check access for' })
  @IsOptional()
  @IsString()
  student_id?: string;

}
