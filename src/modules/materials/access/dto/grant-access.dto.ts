import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsArray, IsOptional, IsEnum } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class GrantAccessDto {
  @ApiProperty({ example: ['uuid-student-1', 'uuid-student-2'], description: 'Student IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  student_ids: string[];

  @ApiProperty({ example: ['uuid-material-1', 'uuid-material-2'], description: 'Material IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  material_ids: string[];

  @ApiProperty({ enum: MaterialType, example: MaterialType.lesson })
  @IsEnum(MaterialType)
  material_type: MaterialType;

  @ApiProperty({ example: true, description: 'Whether to give full access' })
  @IsBoolean()
  @IsOptional()
  full_access?: boolean = true;

  @ApiProperty({ example: ['block-1', 'block-2'], description: 'Specific blocks for partial access' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  accessible_blocks?: string[] = [];
}
