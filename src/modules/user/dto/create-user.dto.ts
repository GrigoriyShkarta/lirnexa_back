import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

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

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'User avatar file' })
  @IsOptional()
  avatar?: any;

  @ApiPropertyOptional({ example: ['uuid1', 'uuid2'], description: 'Category IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}
