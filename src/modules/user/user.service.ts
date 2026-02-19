import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { Role, Prisma } from '@prisma/client';
import { USER_SELECT_FIELDS, PERSONALIZATION_SELECT_FIELDS, USER_LIST_SELECT_FIELDS } from './user.select';
import { UserProfileResponse, UserListItemResponse, PaginatedUserListResponse } from './dto/user-profile.response';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserQueryDto } from './dto/user-query.dto';

@Injectable()
/**
 * Service for user management operations.
 */
export class UserService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  /**
   * Creates a new user in the system.
   * @param creator_id ID of the user creating the new user.
   * @param creator_role Role of the creator.
   * @param dto Data for the new user.
   * @param avatar_file Optional uploaded avatar file.
   */
  async create_user(
    creator_id: string,
    creator_role: Role,
    dto: CreateUserDto,
    avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    const existing_user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing_user) {
      throw new BadRequestException([{ email: 'email_already_exists' }]);
    }

    // Determine the super_admin_id for the new user
    let super_admin_id = creator_id;
    if (creator_role !== Role.super_admin) {
      const creator = await this.prisma.user.findUnique({
        where: { id: creator_id },
        select: { super_admin_id: true },
      });
      super_admin_id = creator?.super_admin_id || creator_id;
    }

    const super_admin = await this.prisma.user.findUnique({
      where: { id: super_admin_id },
      select: { name: true },
    });

    const hashed_password = await bcrypt.hash(dto.password, 10);

    const created_user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed_password,
        role: dto.role, // Allow setting role during creation
        birthday: dto.birthday ? new Date(dto.birthday) : null,
        city: dto.city,
        telegram: dto.telegram,
        instagram: dto.instagram,
        super_admin_id,
        teacher_id: dto.teacher_id || (creator_role === Role.teacher ? creator_id : null),
        categories: dto.categories ? { connect: dto.categories.map((id) => ({ id })) } : undefined,
      },
    });

    if (avatar_file) {
      const sanitized_sa_name = (super_admin?.name || 'admin').replace(/\s+/g, '_');
      const sanitized_student_name = dto.name.replace(/\s+/g, '_');
      const folder_path = `${sanitized_sa_name}${super_admin_id}/students/${sanitized_student_name}${created_user.id}/profile/avatar`;
      const avatar_url = await this.storageService.uploadFile(avatar_file, folder_path);
      await this.prisma.user.update({
        where: { id: created_user.id },
        data: { avatar: avatar_url },
      });
    }

    return { message: 'user_created_successfully' };
  }

  /**
   * Retrieves the current user's information with inherited space settings.
   * @param id The user's ID.
   */
  async get_me(id: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT_FIELDS,
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Inheritance logic: non-super_admin users inherit space settings from their super_admin
    const is_super_admin = user.role === Role.super_admin;
    const target_owner_id = is_super_admin ? user.id : user.super_admin_id;

    if (!is_super_admin && target_owner_id) {
      const inherited_space = await this.prisma.personalization.findUnique({
        where: { user_id: target_owner_id },
        select: PERSONALIZATION_SELECT_FIELDS,
      });

      if (inherited_space) {
        user.personalization = inherited_space;
      }
    }

    // Optional: Provide default space if still null (should not happen if system is consistent)
    if (!user.personalization) {
      user.personalization = {
        id: '',
        title_space: 'Lirnexa',
        icon: '',
        languages: ['uk'],
        select_mode: false,
        bg_color: '#ffffff',
        primary_color: '#2563eb',
        secondary_color: '#64748b',
        bg_color_dark: '#0f0f0f',
        is_white_sidebar_color: true,
        is_show_sidebar_icon: false,
        font_family: 'inter',
      };
    }

    const { personalization, ...userData } = user;

    return {
      ...userData,
      space: {
        personalization,
      },
    };
  }

  /**
   * Updates the current user's profile information.
   * @param id The user's ID.
   * @param dto New profile data.
   * @param avatar_file Optional new avatar file.
   */
  async update_me(
    id: string,
    dto: UpdateMeDto,
    avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (dto.email && dto.email !== user.email) {
      const existing_user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existing_user) {
        throw new BadRequestException([{ email: 'email_already_exists' }]);
      }
    }

    const update_data: Prisma.UserUpdateInput = {
      name: dto.name,
      email: dto.email,
      birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      city: dto.city,
      telegram: dto.telegram,
      instagram: dto.instagram,
    };

    if (avatar_file) {
      // Delete old avatar if it exists
      if (user.avatar) {
        await this.storageService.deleteFile(user.avatar);
      }

      // Find the super_admin who owns the space
      const super_admin_id = (user.role === Role.super_admin ? user.id : user.super_admin_id) || user.id;
      const super_admin = await this.prisma.user.findUnique({
        where: { id: super_admin_id },
        select: { name: true },
      });

      const sanitized_sa_name = (super_admin?.name || 'admin').replace(/\s+/g, '_');
      const sanitized_user_name = (dto.name || user.name).replace(/\s+/g, '_');
      const folder_path = `${sanitized_sa_name}${super_admin_id}/students/${sanitized_user_name}${user.id}/profile/avatar`;
      update_data.avatar = await this.storageService.uploadFile(avatar_file, folder_path);
    }

    await this.prisma.user.update({
      where: { id },
      data: update_data,
    });

    return { message: 'profile_updated_successfully' };
  }

  /**
   * Changes the current user's password.
   * @param id The user's ID.
   * @param dto Data for password change.
   */
  async change_password(id: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 1. Check if current password matches
    const is_password_valid = await bcrypt.compare(dto.current_password, user.password);
    if (!is_password_valid) {
      throw new BadRequestException([{ current_password: 'current_password_invalid' }]);
    }

    // 2. Check if new password and confirm password match
    if (dto.new_password !== dto.confirm_password) {
      throw new BadRequestException([{ confirm_password: 'passwords_do_not_match' }]);
    }

    // 3. Check if new password is same as current
    if (dto.current_password === dto.new_password) {
      throw new BadRequestException([{ new_password: 'new_password_same_as_current' }]);
    }

    const hashed_password = await bcrypt.hash(dto.new_password, 10);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashed_password },
    });

    return { message: 'password_changed_successfully' };
  }

  /**
   * Retrieves a list of users based on the requester's role and hierarchy with pagination and filtering.
   * @param requester_id ID of the user requesting the list.
   * @param requester_role Role of the requester.
   * @param query Pagination and filtering parameters.
   */
  async get_users(
    requester_id: string,
    requester_role: Role,
    query: UserQueryDto,
  ): Promise<PaginatedUserListResponse> {
    const { page = 1, limit = 10, search, role } = query;
    let category_ids = query.category_ids;

    // Handle potential string input from query params (e.g. ?category_ids[]=value or ?category_ids=value)
    if (category_ids && !Array.isArray(category_ids)) {
      category_ids = [category_ids];
    }

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // Role-based hierarchy filtering
    if (requester_role === Role.super_admin) {
      where.super_admin_id = requester_id;
    } else if (requester_role === Role.admin) {
      const admin = await this.prisma.user.findUnique({
        where: { id: requester_id },
        select: { super_admin_id: true },
      });

      if (!admin?.super_admin_id) {
        return {
          data: [],
          meta: { current_page: page, total_pages: 0, total_items: 0 },
        };
      }

      where.super_admin_id = admin.super_admin_id;
    } else if (requester_role === Role.teacher) {
      where.teacher_id = requester_id;
      where.role = Role.student;
    } else {
      return {
        data: [],
        meta: { current_page: page, total_pages: 0, total_items: 0 },
      };
    }

    // Exclude the requester themselves
    where.id = { not: requester_id };

    // Additional filtering from query
    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category_ids && category_ids.length > 0) {
      where.categories = {
        some: {
          id: { in: category_ids },
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT_FIELDS,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data as unknown as UserListItemResponse[],
      meta: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
      },
    };
  }

  /**
   * Updates an existing user's information.
   * @param requester_id ID of the user making the update request.
   * @param requester_role Role of the requester.
   * @param target_user_id ID of the user being updated.
   * @param dto New data for the user.
   * @param avatar_file Optional new avatar file.
   */
  async update_user(
    requester_id: string,
    requester_role: Role,
    target_user_id: string,
    dto: UpdateUserDto,
    avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: target_user_id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Permission check
    let has_permission = false;

    if (requester_id === target_user_id) {
      has_permission = true;
    } else if (requester_role === Role.super_admin && user.super_admin_id === requester_id) {
      has_permission = true;
    } else if (requester_role === Role.admin) {
      const requester = await this.prisma.user.findUnique({
        where: { id: requester_id },
      });
      if (requester?.super_admin_id === user.super_admin_id) {
        has_permission = true;
      }
    } else if (requester_role === Role.teacher && user.teacher_id === requester_id) {
      has_permission = true;
    }

    if (!has_permission) {
      throw new BadRequestException('You do not have permission to update this user');
    }

    if (dto.email && dto.email !== user.email) {
      const existing_user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existing_user) {
        throw new BadRequestException([{ email: 'email_already_exists' }]);
      }
    }

    const update_data: Prisma.UserUpdateInput = {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      city: dto.city,
      telegram: dto.telegram,
      instagram: dto.instagram,
      categories: dto.categories ? { set: dto.categories.map((id) => ({ id })) } : undefined,
    };

    if (dto.teacher_id !== undefined) {
      if (dto.teacher_id === null || dto.teacher_id === '') {
        update_data.teacher = { disconnect: true };
      } else {
        update_data.teacher = { connect: { id: dto.teacher_id } };
      }
    }

    if (dto.password) {
      update_data.password = await bcrypt.hash(dto.password, 10);
    }

    if (avatar_file) {
      // Delete old avatar if it exists
      if (user.avatar) {
        await this.storageService.deleteFile(user.avatar);
      }

      const super_admin = await this.prisma.user.findUnique({
        where: { id: user.super_admin_id || requester_id },
        select: { name: true },
      });

      const sanitized_sa_name = (super_admin?.name || 'admin').replace(/\s+/g, '_');
      const sanitized_student_name = (dto.name || user.name).replace(/\s+/g, '_');
      const folder_path = `${sanitized_sa_name}${user.super_admin_id || requester_id}/students/${sanitized_student_name}${user.id}/profile/avatar`;
      update_data.avatar = await this.storageService.uploadFile(avatar_file, folder_path);
    }

    await this.prisma.user.update({
      where: { id: target_user_id },
      data: update_data,
    });

    return { message: 'user_updated_successfully' };
  }

  /**
   * Deletes a user from the system.
   * @param requester_id ID of the user performing the deletion.
   * @param requester_role Role of the requester.
   * @param target_user_id ID of the user to be deleted.
   */
  async delete_user(
    requester_id: string,
    requester_role: Role,
    target_user_id: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: target_user_id },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Permission check
    let has_permission = false;

    if (requester_role === Role.super_admin && user.super_admin_id === requester_id) {
      // Super admin can delete anyone in their space except themselves
      if (requester_id !== target_user_id) {
        has_permission = true;
      }
    } else if (requester_role === Role.admin) {
      const requester = await this.prisma.user.findUnique({
        where: { id: requester_id },
      });
      // Admin can delete users in the same space, but not the super_admin
      if (
        requester?.super_admin_id === user.super_admin_id &&
        user.role !== Role.super_admin &&
        requester_id !== target_user_id
      ) {
        has_permission = true;
      }
    } else if (requester_role === Role.teacher && user.teacher_id === requester_id) {
      // Teacher can delete their students
      has_permission = true;
    }

    if (!has_permission) {
      throw new BadRequestException('You do not have permission to delete this user');
    }

    // If deleting a teacher, reassign their students (they will remain assigned to the same super_admin)
    if (user.role === Role.teacher) {
      await this.prisma.user.updateMany({
        where: { teacher_id: target_user_id },
        data: { teacher_id: null },
      });
    }

    // Cleanup: Delete avatar from storage if exists
    if (user.avatar) {
      await this.storageService.deleteFile(user.avatar);
    }

    // Final deletion
    await this.prisma.user.delete({
      where: { id: target_user_id },
    });

    return { message: 'user_deleted_successfully' };
  }
}

