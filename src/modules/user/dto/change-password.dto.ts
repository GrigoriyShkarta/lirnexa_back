import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Data transfer object for changing user password.
 */
export class ChangePasswordDto {
  @ApiProperty({ example: 'password123', description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'current_password_required' })
  current_password: string;

  @ApiProperty({ example: 'newPassword123', description: 'New password (min 6 characters)' })
  @IsString()
  @MinLength(6, { message: 'password_too_short' })
  @IsNotEmpty({ message: 'new_password_required' })
  new_password: string;

  @ApiProperty({ example: 'newPassword123', description: 'Confirm new password' })
  @IsString()
  @IsNotEmpty({ message: 'confirm_password_required' })
  confirm_password: string;
}
