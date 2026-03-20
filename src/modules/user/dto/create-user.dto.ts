import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

/**
 * Data transfer object for creating a new user.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  @IsString()
  @IsNotEmpty({ message: 'name_is_required' })
  name: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'invalid_email' })
  @IsNotEmpty({ message: 'email_is_required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password (min 6 characters)' })
  @IsString()
  @MinLength(6, { message: 'password_too_short' })
  @IsNotEmpty({ message: 'password_is_required' })
  password: string;

  @ApiProperty({ enum: Role, example: Role.student, description: 'User role' })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiPropertyOptional({ example: '2000-01-01', description: 'Date of birth' })
  @IsDateString()
  @IsOptional()
  birthday?: string;

  @ApiPropertyOptional({ example: 'Kyiv', description: 'City' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: '@telegram', description: 'Telegram handle' })
  @IsString()
  @IsOptional()
  telegram?: string;

  @ApiPropertyOptional({ example: '@instagram', description: 'Instagram handle' })
  @IsString()
  @IsOptional()
  instagram?: string;

  @ApiPropertyOptional({ example: 'uuid-string', description: 'ID of the teacher' })
  @IsString()
  @IsOptional()
  teacher_id?: string;

  @ApiPropertyOptional({ example: 'Improve my speaking skills', description: 'Learning goals' })
  @IsString()
  @IsOptional()
  learning_goals?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'User avatar file' })
  @IsOptional()
  avatar?: any;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], description: 'Category IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiPropertyOptional({ enum: UserStatus, example: UserStatus.active, description: 'User status' })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ example: false, description: 'Is avatar locked' })
  @IsBoolean()
  @IsOptional()
  is_avatar_locked?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Is name locked' })
  @IsBoolean()
  @IsOptional()
  is_name_locked?: boolean;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Deactivation date' })
  @IsDateString()
  @IsOptional()
  deactivation_date?: string;

  @ApiPropertyOptional({ example: false, description: 'Can student create trackers' })
  @IsBoolean()
  @IsOptional()
  can_student_create_tracker?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Can student edit trackers' })
  @IsBoolean()
  @IsOptional()
  can_student_edit_tracker?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Is lesson recording enabled for this student' })
  @IsBoolean()
  @IsOptional()
  is_recording_enabled?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Can student download lesson recordings' })
  @IsBoolean()
  @IsOptional()
  can_student_download_recording?: boolean;
}
