import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../../category/dto/category-response.dto';

export class LessonAuthorResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ required: false })
  avatar?: string;
}

export class LessonResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  cover_url?: string;

  @ApiProperty()
  cover_position: number;

  @ApiProperty()
  content: any;

  @ApiProperty()
  author_id: string;

  @ApiProperty({ required: false })
  duration?: number;

  @ApiProperty({ type: () => LessonAuthorResponseDto })
  author: LessonAuthorResponseDto;

  @ApiProperty({ type: () => [CategoryResponseDto], required: false })
  categories?: CategoryResponseDto[];

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class PaginatedLessonResponseDto {
  @ApiProperty({ type: [LessonResponseDto] })
  data: LessonResponseDto[];

  @ApiProperty()
  meta: any;
}
