import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsEnum } from 'class-validator';
import { MaterialType } from '@prisma/client';

export class RevokeAccessDto {
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
  @IsNotEmpty()
  material_type: MaterialType;
}
