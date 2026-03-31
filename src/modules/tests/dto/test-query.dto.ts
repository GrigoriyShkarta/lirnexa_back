import { IsOptional, IsString, IsInt, Min, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class TestQueryDto {
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

  @ApiPropertyOptional({ example: 'Search term', description: 'Search by test name' })
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

  @ApiPropertyOptional({ description: 'Filter tests that student has access to' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  from_student?: boolean;

  @ApiPropertyOptional({ description: 'Specific student ID to check access for' })
  @IsOptional()
  @IsString()
  student_id?: string;
}
