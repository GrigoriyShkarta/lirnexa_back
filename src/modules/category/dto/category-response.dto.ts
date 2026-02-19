import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Grammar' })
  name: string;

  @ApiProperty({ example: '#ff0000', required: false, nullable: true })
  color?: string | null;

  @ApiProperty({ example: 'uuid', required: false, nullable: true })
  super_admin_id?: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  current_page: number;

  @ApiProperty({ example: 10 })
  total_pages: number;

  @ApiProperty({ example: 100 })
  total_items: number;
}

export class PaginatedCategoryResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty()
  meta: PaginationMeta;
}
