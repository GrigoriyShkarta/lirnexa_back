import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
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
import { GoogleCalendarService } from '../integrations/google-calendar/google-calendar.service';

@Injectable()
/**
 * Service for user management operations.
 */
export class UserService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    @Inject(forwardRef(() => GoogleCalendarService))
    private googleCalendarService: GoogleCalendarService,
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
        learning_goals: dto.learning_goals,
        status: dto.status || 'active',
        is_avatar_locked: dto.is_avatar_locked ?? false,
        is_name_locked: dto.is_name_locked ?? false,
        deactivation_date: dto.deactivation_date ? new Date(dto.deactivation_date) : null,
        super_admin_id,
        teacher_id: dto.teacher_id || (creator_role === Role.teacher ? creator_id : null),
        categories: dto.categories ? { connect: dto.categories.map((id) => ({ id })) } : undefined,
        can_student_create_tracker: dto.can_student_create_tracker ?? false,
        can_student_edit_tracker: dto.can_student_edit_tracker ?? false,
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

    // Lazy deactivation check
    if (user.status === 'active' && user.deactivation_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(user.deactivation_date) <= today) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { status: 'inactive' },
        });
        user.status = 'inactive';
      }
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
        currency: 'UAH',
        dashboard_personalization: {
          student_dashboard_title: null,
          student_dashboard_description: null,
          student_dashboard_hero_image: null,
          student_announcement: null,
          is_show_student_progress: false,
          student_social_instagram: null,
          student_support_telegram: null,
          dashboard_title: null,
          dashboard_description: null,
          dashboard_hero_image: null,
        },
      };
    }

    const { personalization, ...userData } = user;
    let payment_reminder_date: Date | null = null;

    if (user.role === Role.student) {
      const reminder_sub = await this.prisma.studentSubscription.findFirst({
        where: {
          student_id: user.id,
          payment_reminder: true,
        },
        include: {
          lessons: {
            where: { date: { not: null } },
            orderBy: { date: 'asc' },
            take: 1,
          },
        },
      });

      if (reminder_sub?.lessons?.[0]) {
        payment_reminder_date = reminder_sub.lessons[0].date;
      }
    }

    const { dashboard_personalization, ...personalization_data } = personalization as any;

    return {
      ...userData,
      payment_reminder_date,
      space: {
        personalization: personalization_data,
        dashboard_personalization,
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

    if (dto.name && dto.name !== user.name && user.is_name_locked) {
      throw new BadRequestException([{ name: 'name_is_locked' }]);
    }

    if (avatar_file && user.is_avatar_locked) {
      throw new BadRequestException([{ avatar: 'avatar_is_locked' }]);
    }

    const update_data: Prisma.UserUpdateInput = {
      name: dto.name,
      email: dto.email,
      birthday: dto.birthday ? new Date(dto.birthday) : undefined,
      city: dto.city,
      telegram: dto.telegram,
      instagram: dto.instagram,
      learning_goals: dto.learning_goals,
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Bulk deactivation check before listing
    await this.prisma.user.updateMany({
      where: {
        status: 'active',
        deactivation_date: { lte: today },
      },
      data: { status: 'inactive' },
    });

    const { page = 1, limit = 10, search, role, sortBy = 'payment_date', sortOrder = 'desc' } = query;
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

    if (query.payment_statuses && query.payment_statuses.length > 0) {
      where.purchased_subscriptions = {
        some: {
          payment_status: { in: query.payment_statuses as any },
        },
      };
    }

    // 1. Get all matching users with their subscription payment dates for sorting
    const matchingUsers = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        status: true,
        created_at: true,
        purchased_subscriptions: {
          select: {
            payment_status: true,
            payment_date: true,
            partial_payment_date: true,
            next_payment_date: true,
          },
        },
      },
    });

    // 2. Calculate the "target" data for sorting for each user
    const usersWithSortData = matchingUsers.map((user) => {
      let sortDate: Date | null = null;
      let primaryStatusWeight = 999; // Default for users without subscriptions
      
      const statusWeights: Record<string, number> = {
        unpaid: 0,
        partially_paid: 1,
        paid: 2,
      };

      user.purchased_subscriptions.forEach((sub) => {
        // Handle Date Sorting
        let dateToConsider: Date | null = null;
        if (sortBy === 'next_payment_date') {
          dateToConsider = sub.payment_status === 'partially_paid' ? sub.partial_payment_date : sub.next_payment_date;
        } else {
          dateToConsider = sub.payment_status === 'partially_paid' ? sub.partial_payment_date : sub.payment_date;
        }

        if (dateToConsider) {
          const dateObj = new Date(dateToConsider);
          if (!sortDate || dateObj > sortDate) {
            sortDate = dateObj;
          }
        }

        // Handle Status Sorting Logic (take the "worst" status as primary for the user)
        const currentWeight = statusWeights[sub.payment_status] ?? 999;
        if (currentWeight < primaryStatusWeight) {
          primaryStatusWeight = currentWeight;
        }
      });

      return {
        id: user.id as string,
        status: user.status as string,
        created_at: new Date(user.created_at),
        sort_date: sortDate,
        status_weight: primaryStatusWeight,
      };
    });

    // 3. Sort users
    usersWithSortData.sort((a: any, b: any) => {
      // Always group by system status first (active before inactive)
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }

      const orderMultiplier = sortOrder === 'asc' ? 1 : -1;

      // Logic for sorting by Payment Status
      if (sortBy === 'payment_status') {
        if (a.status_weight !== b.status_weight) {
          return (a.status_weight - b.status_weight) * orderMultiplier;
        }
      }

      // Logic for sorting by Dates
      if (a.sort_date && b.sort_date) {
        return (
          ((a.sort_date as Date).getTime() - (b.sort_date as Date).getTime()) * orderMultiplier
        );
      }
      
      if (a.sort_date) return -1;
      if (b.sort_date) return 1;

      // Fallback: sort by created_at
      return (
        ((a.created_at as Date).getTime() - (b.created_at as Date).getTime()) * orderMultiplier
      );
    });

    const total = usersWithSortData.length;
    const paginatedUsers = usersWithSortData.slice(skip, skip + limit);
    const paginatedIds = paginatedUsers.map((u) => u.id);

    // 4. Fetch full data for the current page, preserving the sort order
    const select: any = { ...USER_LIST_SELECT_FIELDS };
    if (query.include_subscriptions) {
      select.purchased_subscriptions = {
        include: {
          subscription: true,
          lessons: true,
        },
      };
    }

    const data = await this.prisma.user.findMany({
      where: { id: { in: paginatedIds } },
      select,
    });

    // Sort the final results to match the paginatedIds order
    const orderedData = paginatedIds
      .map((id) => data.find((user: any) => user.id === id))
      .filter(Boolean);

    return {
      data: orderedData as unknown as UserListItemResponse[],
      meta: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
      },
    };
  }

  /**
   * Retrieves a specific user's information by ID with permission checks.
   * @param requester_id ID of the user making the request.
   * @param requester_role Role of the requester.
   * @param target_user_id ID of the user being retrieved.
   */
  async get_user_by_id(
    requester_id: string,
    requester_role: Role,
    target_user_id: string,
  ): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: target_user_id },
      select: { id: true, super_admin_id: true, teacher_id: true, role: true },
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
        select: { super_admin_id: true },
      });
      if (requester?.super_admin_id === user.super_admin_id) {
        has_permission = true;
      }
    } else if (requester_role === Role.teacher && user.teacher_id === requester_id) {
      has_permission = true;
    }

    if (!has_permission) {
      throw new BadRequestException('You do not have permission to view this user');
    }

    return this.get_me(target_user_id);
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
      learning_goals: dto.learning_goals,
      categories: dto.categories ? { set: dto.categories.map((id) => ({ id })) } : undefined,
      status: dto.status,
      is_name_locked: dto.is_name_locked,
      is_avatar_locked: dto.is_avatar_locked,
      can_student_create_tracker: dto.can_student_create_tracker,
      can_student_edit_tracker: dto.can_student_edit_tracker,
    };

    if (dto.deactivation_date) {
      const deactivationDate = new Date(dto.deactivation_date);
      deactivationDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deactivationDate <= today) {
        update_data.status = 'inactive';
      }
      update_data.deactivation_date = deactivationDate;
    }

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

    // Google Calendar cleanup: remove synced events and tokens
    await this.googleCalendarService.disconnect(target_user_id);

    // Final deletion
    await this.prisma.user.delete({
      where: { id: target_user_id },
    });

    return { message: 'user_deleted_successfully' };
  }

  /**
   * Deletes multiple users at once.
   * @param requester_id ID of the user performing the deletion.
   * @param requester_role Role of the requester.
   * @param ids Array of user IDs to be deleted.
   */
  async bulk_delete_users(
    requester_id: string,
    requester_role: Role,
    ids: string[],
  ): Promise<{ message: string }> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
    });

    if (users.length === 0) {
      throw new BadRequestException('No users found with given IDs');
    }

    const authorized_ids: string[] = [];
    const avatars_to_delete: string[] = [];
    const teachers_to_unassign: string[] = [];

    // Check permissions for each user exactly like in single delete_user
    for (const user of users) {
      let has_permission = false;

      if (requester_role === Role.super_admin && user.super_admin_id === requester_id) {
        if (requester_id !== user.id) {
          has_permission = true;
        }
      } else if (requester_role === Role.admin) {
        const requester = await this.prisma.user.findUnique({
          where: { id: requester_id },
        });
        if (
          requester?.super_admin_id === user.super_admin_id &&
          user.role !== Role.super_admin &&
          requester_id !== user.id
        ) {
          has_permission = true;
        }
      } else if (requester_role === Role.teacher && user.teacher_id === requester_id) {
        has_permission = true;
      }

      if (has_permission) {
        authorized_ids.push(user.id);
        if (user.avatar) avatars_to_delete.push(user.avatar);
        if (user.role === Role.teacher) teachers_to_unassign.push(user.id);
      }
    }

    if (authorized_ids.length === 0) {
      throw new BadRequestException('You do not have permission to delete any of the selected users');
    }

    // Unassign students from teachers being deleted
    if (teachers_to_unassign.length > 0) {
      await this.prisma.user.updateMany({
        where: { teacher_id: { in: teachers_to_unassign } },
        data: { teacher_id: null },
      });
    }

    // Delete avatars from storage
    await Promise.all(avatars_to_delete.map((url) => this.storageService.deleteFile(url)));

    // Cleanup Google Calendar for all deleted users
    await Promise.all(authorized_ids.map((id) => this.googleCalendarService.disconnect(id)));

    // Final bulk deletion
    await this.prisma.user.deleteMany({
      where: { id: { in: authorized_ids } },
    });

    return { message: `${authorized_ids.length}_users_deleted_successfully` };
  }
}

