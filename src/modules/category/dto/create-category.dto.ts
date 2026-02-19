import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryItemDto {
  @ApiProperty({ example: 'Grammar', description: 'Name of the category' })
  @IsString()
  @IsNotEmpty({ message: 'category_name_required' })
  name: string;

  @ApiPropertyOptional({ example: '#ff0000', description: 'Color of the category' })
  @IsString()
  @IsOptional()
  color?: string;
}

export class CreateCategoryDto {
  @ApiProperty({ type: [CategoryItemDto], description: 'Array of categories to create or single category object' })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CategoryItemDto)
  @IsArray()
  categories?: CategoryItemDto[];

  // Fallback for single category creation (backward compatibility)
  @ApiPropertyOptional({ example: 'Grammar', description: 'Name of the category' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '#ff0000', description: 'Color of the category' })
  @IsOptional()
  @IsString()
  color?: string;
}
