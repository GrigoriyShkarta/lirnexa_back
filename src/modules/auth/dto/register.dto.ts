import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for user registration.
 */
export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'invalid_email' })
  @IsNotEmpty({ message: 'email_is_required' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  @IsString({ message: 'name_must_be_a_string' })
  @IsNotEmpty({ message: 'name_is_required' })
  name: string;

  @ApiProperty({ example: 'password123', description: 'User password (min 6 characters)' })
  @IsString({ message: 'password_must_be_a_string' })
  @MinLength(6, { message: 'password_too_short' })
  @IsNotEmpty({ message: 'password_is_required' })
  password: string;
}
