import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class CreateStudentSubscriptionDto {
  @ApiProperty({ example: 'uuid-template', description: 'Template Subscription ID' })
  @IsString()
  @IsNotEmpty()
  subscription_id: string;

  @ApiProperty({ example: 'uuid-student', description: 'Student ID' })
  @IsString()
  @IsNotEmpty()
  student_id: string;

  @ApiPropertyOptional({ example: 50, description: 'Amount already paid' })
  @IsNumber()
  @IsOptional()
  paid_amount?: number;

  @ApiPropertyOptional({ enum: PaymentStatus, example: PaymentStatus.partially_paid })
  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiPropertyOptional({ example: '2026-02-20T12:00:00Z', description: 'Payment date' })
  @IsDateString()
  @IsOptional()
  payment_date?: string;

  @ApiPropertyOptional({ example: '2026-02-21T12:00:00Z', description: 'Partial payment date' })
  @IsDateString()
  @IsOptional()
  partial_payment_date?: string;

  @ApiPropertyOptional({ example: '2026-03-20T12:00:00Z', description: 'Next payment date' })
  @IsDateString()
  @IsOptional()
  next_payment_date?: string;

  @ApiPropertyOptional({ example: false, description: 'Payment reminder 1 week before' })
  @IsOptional()
  payment_reminder?: boolean;

  @ApiPropertyOptional({ example: ['2026-02-21T10:00:00Z'], description: 'Initial lesson dates' })
  @IsArray()
  @IsOptional()
  @IsDateString({}, { each: true })
  lesson_dates?: string[];

  @ApiPropertyOptional({ example: ['mon', 'wed'], description: 'Selected days of week' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selected_days?: string[];
}
