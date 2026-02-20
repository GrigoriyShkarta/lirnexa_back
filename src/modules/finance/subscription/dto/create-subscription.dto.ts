import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'Basic Plan', description: 'Name of the subscription' })
  @IsString()
  @IsNotEmpty({ message: 'subscription_name_required' })
  name: string;

  @ApiProperty({ example: 100, description: 'Price of the subscription' })
  @IsNumber()
  @IsNotEmpty({ message: 'subscription_price_required' })
  price: number;

  @ApiProperty({ example: 8, description: 'Number of lessons' })
  @IsNumber()
  @IsNotEmpty({ message: 'subscription_lessons_count_required' })
  lessons_count: number;

  @ApiProperty({ example: 'student-uuid', description: 'Student ID', required: false })
  @IsString()
  @IsOptional()
  student_id?: string;
}
