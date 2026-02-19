import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from '../../../category/dto/category-response.dto';

export class CourseAuthorResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  email: string;
  @ApiProperty({ required: false })
  avatar?: string;
}

export class CourseResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  image_url?: string;

  @ApiProperty()
  content: any;

  @ApiProperty()
  author_id: string;

  @ApiProperty({ required: false })
  duration?: number;

  @ApiProperty({ type: () => CourseAuthorResponseDto })
  author: CourseAuthorResponseDto;

  @ApiProperty({ type: () => [CategoryResponseDto], required: false })
  categories?: CategoryResponseDto[];

  @ApiProperty({ type: () => CategoryResponseDto, required: false, nullable: true })
  category?: CategoryResponseDto | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class PaginatedCourseResponseDto {
  @ApiProperty({ type: [CourseResponseDto] })
  data: CourseResponseDto[];

  @ApiProperty()
  meta: any;
}
