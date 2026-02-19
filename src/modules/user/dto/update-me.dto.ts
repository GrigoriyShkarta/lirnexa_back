import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Data transfer object for a user updating their own profile.
 * Users cannot change their own role or teacher through this DTO.
 */
export class UpdateMeDto extends PartialType(
  OmitType(CreateUserDto, ['role', 'teacher_id', 'password'] as const),
) {}
