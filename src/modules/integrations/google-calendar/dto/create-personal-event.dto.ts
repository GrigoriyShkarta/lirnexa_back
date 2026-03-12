import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsDateString, IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

class AttendeeDto {
  @ApiProperty({ example: 'student@example.com' })
  @IsEmail()
  email: string;
}

export class CreatePersonalEventDto {
  @ApiProperty({ example: 'Meeting with client' })
  @IsString()
  @IsNotEmpty()
  summary: string;

  @ApiProperty({ example: 'Discuss project details', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-03-12T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  start_time: string;

  @ApiProperty({ example: '2026-03-12T11:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  end_time: string;

  @ApiProperty({ type: [AttendeeDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttendeeDto)
  attendees?: AttendeeDto[];
}
