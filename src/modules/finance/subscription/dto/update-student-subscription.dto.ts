import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsEnum, IsDateString, IsArray, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class UpdateStudentSubscriptionDto {
  @ApiPropertyOptional({ example: 50, description: 'Amount already paid' })
  @IsNumber()
  @IsOptional()
  paid_amount?: number;

  @ApiPropertyOptional({ enum: PaymentStatus, example: PaymentStatus.paid })
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

  @ApiPropertyOptional({ example: true, description: 'Payment reminder 1 week before' })
  @IsOptional()
  payment_reminder?: boolean;

  @ApiPropertyOptional({ example: ['mon', 'wed'], description: 'Selected days of week' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selected_days?: string[];
}
