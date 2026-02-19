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
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
  @IsArray()
  @IsString({ each: true })
  category_ids?: string[];
}
