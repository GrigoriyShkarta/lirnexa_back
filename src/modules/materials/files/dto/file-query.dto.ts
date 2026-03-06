import { IsOptional, IsString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class FileQueryDto {
  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ required: false, default: '10' })
  @IsOptional()
  @IsString()
  limit?: string;

  @ApiPropertyOptional({ required: false })
  @IsOptional()
  @IsString()
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
}
