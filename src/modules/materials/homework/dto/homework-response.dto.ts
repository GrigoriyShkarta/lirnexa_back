import { ApiProperty } from '@nestjs/swagger';

export class HomeworkResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  content: any[];

  @ApiProperty()
  lesson_id: string;

  @ApiProperty()
  author_id: string;

  @ApiProperty()
  super_admin_id: string;

  @ApiProperty({ required: false })
  created_at: Date;

  @ApiProperty({ required: false })
  updated_at: Date;

  @ApiProperty({ required: false, example: 'pending' })
  submission_status?: string;
}

export class PaginatedHomeworkResponseDto {
  @ApiProperty({ type: [HomeworkResponseDto] })
  data: HomeworkResponseDto[];

  @ApiProperty()
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export class HomeworkSubmissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  homework_id: string;

  @ApiProperty()
  student_id: string;

  @ApiProperty({ required: false })
  text?: string;

  @ApiProperty({ type: [String] })
  file_urls: string[];

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  feedback?: string;

  @ApiProperty({ required: false })
  reviewed_by_id?: string;

  @ApiProperty({ required: false })
  created_at: Date;

  @ApiProperty({ required: false })
  updated_at: Date;
}
