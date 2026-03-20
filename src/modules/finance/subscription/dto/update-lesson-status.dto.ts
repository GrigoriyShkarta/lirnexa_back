import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { SubscriptionLessonStatus } from '@prisma/client';

export class UpdateLessonStatusDto {
  @ApiPropertyOptional({ example: '2026-02-21T10:00:00Z', description: 'Date of the lesson' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ enum: SubscriptionLessonStatus, example: SubscriptionLessonStatus.attended })
  @IsEnum(SubscriptionLessonStatus)
  @IsOptional()
  status?: SubscriptionLessonStatus;

}
