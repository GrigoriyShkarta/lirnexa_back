import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SpaceResponse } from '../../space/dto/space.response';
import { CategoryResponseDto } from '../../category/dto/category-response.dto';

/**
 * Nested space configuration in user profile.
 */
export class UserSpaceResponse {
  @ApiPropertyOptional({ type: () => SpaceResponse, description: 'User personalization settings' })
  personalization: SpaceResponse | null;
}

/**
 * Base properties for user responses.
 */
export class UserBaseResponse {
  @ApiProperty({ example: 'uuid-string', description: 'User unique identifier' })
  id: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User display name' })
  name: string;

  @ApiProperty({ enum: Role, example: Role.student, description: 'User role' })
  role: Role;

  @ApiPropertyOptional({ example: '2000-01-01T00:00:00.000Z', description: 'Date of birth' })
  birthday: Date | null;

  @ApiPropertyOptional({ example: 'Kyiv', description: 'User city' })
  city: string | null;

  @ApiPropertyOptional({ example: '@telegram', description: 'Telegram handle' })
  telegram: string | null;

  @ApiPropertyOptional({ example: '@instagram', description: 'Instagram handle' })
  instagram: string | null;

  @ApiPropertyOptional({ example: 'http://example.com/avatar.jpg', description: 'User avatar URL' })
  avatar: string | null;

  @ApiPropertyOptional({ example: 'uuid-string', description: 'ID of the super admin' })
  super_admin_id: string | null;

  @ApiPropertyOptional({ example: 'uuid-string', description: 'ID of the teacher' })
  teacher_id: string | null;

  @ApiPropertyOptional({ example: false, description: 'Is user premium' })
  is_premium: boolean;

  @ApiPropertyOptional({ type: () => [CategoryResponseDto], description: 'User categories' })
  user_categories?: CategoryResponseDto[] | null;
}

/**
 * Response DTO for user profile data (with nested space).
 */
export class UserProfileResponse extends UserBaseResponse {
  @ApiPropertyOptional({
    description: 'User space wrapper',
    type: () => UserSpaceResponse,
  })
  space: UserSpaceResponse;
}

/**
 * Response DTO for user item in a list (flat personalization).
 */
export class UserListItemResponse extends UserBaseResponse {}

/**
 * Metadata for paginated responses.
 */
export class PaginationMeta {
  @ApiProperty({ example: 1, description: 'Current page number' })
  current_page: number;

  @ApiProperty({ example: 10, description: 'Total number of pages' })
  total_pages: number;

  @ApiProperty({ example: 100, description: 'Total number of items' })
  total_items: number;
}

/**
 * Paginated response for user listing.
 */
export class PaginatedUserListResponse {
  @ApiProperty({ type: [UserListItemResponse], description: 'List of users' })
  data: UserListItemResponse[];

  @ApiProperty({ type: PaginationMeta, description: 'Pagination metadata' })
  meta: PaginationMeta;
}


