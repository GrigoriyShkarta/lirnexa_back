import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus, SubscriptionLessonStatus } from '@prisma/client';

class AuthorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  avatar: string | null;
}

export class SubscriptionTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  lessons_count: number;

  @ApiProperty()
  author_id: string;

  @ApiPropertyOptional()
  super_admin_id: string | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiPropertyOptional({ type: AuthorResponseDto })
  author?: AuthorResponseDto;
}

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

export class PaginatedSubscriptionTemplateResponseDto {
  @ApiProperty({ type: [SubscriptionTemplateResponseDto] })
  data: SubscriptionTemplateResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class SubscriptionLessonResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  student_subscription_id: string;

  @ApiPropertyOptional()
  date: Date | null;

  @ApiProperty({ enum: SubscriptionLessonStatus })
  status: SubscriptionLessonStatus;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

export class StudentSubscriptionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  paid_amount: number;

  @ApiProperty({ enum: PaymentStatus })
  payment_status: PaymentStatus;

  @ApiPropertyOptional()
  payment_date: Date | null;

  @ApiPropertyOptional()
  partial_payment_date: Date | null;

  @ApiPropertyOptional()
  next_payment_date: Date | null;

  @ApiProperty()
  payment_reminder: boolean;

  @ApiPropertyOptional({ example: ['mon', 'wed'], description: 'Selected days of week' })
  selected_days: string[];

  @ApiProperty()
  student_id: string;

  @ApiProperty()
  subscription_id: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  @ApiPropertyOptional({ type: [SubscriptionLessonResponseDto] })
  lessons?: SubscriptionLessonResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: { id: { type: 'string' }, name: { type: 'string' }, lessons_count: { type: 'number' } },
  })
  subscription: { id: string; name: string; lessons_count: number };
}
