import { IsEmail, IsNotEmpty, MinLength, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data transfer object for user login.
 */
export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail({}, { message: 'invalid_email' })
  @IsNotEmpty({ message: 'email_is_required' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'User password' })
  @IsString({ message: 'password_must_be_a_string' })
  @IsNotEmpty({ message: 'password_is_required' })
  password: string;
}
