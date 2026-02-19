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
}
