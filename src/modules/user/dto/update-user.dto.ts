import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

/**
 * Data transfer object for updating an existing user.
 * All fields from CreateUserDto are optional.
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'password123', description: 'User password (min 6 characters)' })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.password && o.password !== '')
  @MinLength(6, { message: 'password_too_short' })
  password?: string;
}
