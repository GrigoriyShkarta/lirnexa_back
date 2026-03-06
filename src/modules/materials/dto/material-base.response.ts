import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../category/dto/category-response.dto';

export class MaterialBaseResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'My Material' })
  name: string;

  @ApiProperty({ example: 'https://...' })
  file_url: string;

  @ApiProperty({ example: 'key' })
  file_key: string;

  @ApiProperty({ example: 'uuid', required: false })
  super_admin_id?: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiProperty({ type: () => [CategoryResponseDto], required: false })
  categories?: CategoryResponseDto[];

  @ApiProperty({ type: [String], description: 'List of student IDs who have access to this material', required: false })
  accessible_student_ids?: string[];

  @ApiProperty({ description: 'Whether the specified student has access to this material', required: false })
  has_access?: boolean;
}
