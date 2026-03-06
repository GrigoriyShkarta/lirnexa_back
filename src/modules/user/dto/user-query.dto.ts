import { IsOptional, IsString, IsEnum, IsInt, Min, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Type, Transform } from 'class-transformer';

/**
 * Query parameters for listing users with pagination and filtering.
 */
export class UserQueryDto {
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

  @ApiPropertyOptional({ example: 'John', description: 'Search query (name or email)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Role, description: 'Filter by role' })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional({ example: ['uuid-1', 'uuid-2'], description: 'Filter by category IDs' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
  category_ids?: string[];

  @ApiPropertyOptional({ example: ['paid', 'partially_paid'], description: 'Filter by payment statuses' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return [];
  })
  payment_statuses?: string[];

  @ApiPropertyOptional({ example: true, description: 'Include student subscriptions' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  include_subscriptions?: boolean;

  @ApiPropertyOptional({ example: 'payment_date', description: 'Sort by field (e.g., payment_date, next_payment_date, payment_status, created_at)' })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'], description: 'Sort order' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
