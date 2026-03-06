import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '@prisma/client';

export class MaterialAccessResponseDto {
  @ApiProperty({ example: 'uuid-access' })
  id: string;

  @ApiProperty({ example: 'uuid-material' })
  material_id: string;

  @ApiProperty({ enum: MaterialType, example: MaterialType.lesson })
  material_type: MaterialType;

  @ApiProperty({ example: 'uuid-student' })
  student_id: string;

  @ApiProperty({ example: 'uuid-granter' })
  granted_by_id: string;

  @ApiProperty({ example: true, description: 'Whether full access is granted' })
  full_access: boolean;

  @ApiProperty({ example: ['block-id-1'], description: 'List of accessible block IDs for partial access' })
  accessible_blocks: string[];

  @ApiProperty({ required: false, description: 'Lesson details if material_type is lesson' })
  lesson?: any;

  @ApiProperty({ required: false, description: 'Photo details if material_type is photo' })
  photo?: any;

  @ApiProperty({ required: false, description: 'Video details if material_type is video' })
  video?: any;

  @ApiProperty({ required: false, description: 'Audio details if material_type is audio' })
  audio?: any;

  @ApiProperty({ required: false, description: 'File details if material_type is file' })
  file?: any;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
