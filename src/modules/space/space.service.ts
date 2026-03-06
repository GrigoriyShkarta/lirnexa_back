import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SafeSpaceDto } from './dto/save-space.dto';
import { Role, Personalization } from '@prisma/client';

import { StorageService } from '../storage/storage.service';

@Injectable()
/**
 * Service for managing space customization settings.
 */
export class SpaceService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  /**
   * Retrieves space settings for the current user or their associated super_admin.
   * @param user_id Current user ID.
   * @param role Current user role.
   */
  async get_space(user_id: string, role: Role): Promise<Personalization | Partial<Personalization>> {
    let target_super_admin_id = user_id;

    if (role !== Role.super_admin) {
      const user = await this.prisma.user.findUnique({
        where: { id: user_id },
        select: { super_admin_id: true },
      });

      if (!user || !user.super_admin_id) {
        throw new NotFoundException('super_admin_not_found');
      }
      target_super_admin_id = user.super_admin_id;
    }

    const space = await this.prisma.personalization.findUnique({
      where: { user_id: target_super_admin_id },
      include: { dashboard_personalization: true },
    });

    if (!space) {
      // If no space exists, return default values
      return {
        title_space: 'Lirnexa',
        icon: '',
        languages: ['uk'],
        select_mode: false,
        bg_color: '#ffffff',
        primary_color: '#2563eb',
        secondary_color: '#64748b',
        bg_color_dark: '#0f0f0f',
        currency: 'UAH',
      };
    }

    return space;
  }

  /**
   * Saves space settings for a super_admin.
   * @param user_id Current user ID (must be super_admin).
   * @param dto Space settings data.
   * @param icon_file Optional uploaded icon file.
   * @param student_hero_file Optional student dashboard hero image.
   * @param admin_hero_file Optional admin dashboard hero image.
   */
  async save_space(
    user_id: string,
    dto: SafeSpaceDto,
    icon_file?: Express.Multer.File,
    student_hero_file?: Express.Multer.File,
    admin_hero_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: {
        name: true,
        id: true,
        personalization: {
          select: {
            icon: true,
            dashboard_personalization: {
              select: {
                student_dashboard_hero_image: true,
                dashboard_hero_image: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('user_not_found');
    }

    const sanitized_name = user.name.replace(/\s+/g, '_');
    const folder_path = `${sanitized_name}${user.id}/space`;

    let icon_url: string | undefined;
    if (icon_file) {
      if (user.personalization?.icon) {
        await this.storageService.deleteFile(user.personalization.icon);
      }
      icon_url = await this.storageService.uploadFile(icon_file, folder_path);
    }

    let student_hero_url: string | undefined;
    if (student_hero_file) {
      if (user.personalization?.dashboard_personalization?.student_dashboard_hero_image) {
        await this.storageService.deleteFile(
          user.personalization.dashboard_personalization.student_dashboard_hero_image,
        );
      }
      student_hero_url = await this.storageService.uploadFile(student_hero_file, folder_path);
    }

    let admin_hero_url: string | undefined;
    if (admin_hero_file) {
      if (user.personalization?.dashboard_personalization?.dashboard_hero_image) {
        await this.storageService.deleteFile(
          user.personalization.dashboard_personalization.dashboard_hero_image,
        );
      }
      admin_hero_url = await this.storageService.uploadFile(admin_hero_file, folder_path);
    }

    const dashboard_data = {
      student_dashboard_title: dto.student_dashboard_title,
      student_dashboard_description: dto.student_dashboard_description,
      student_announcement: dto.student_announcement,
      is_show_student_progress: dto.is_show_student_progress,
      student_social_instagram: dto.student_social_instagram,
      student_support_telegram: dto.student_support_telegram,
      dashboard_title: dto.dashboard_title,
      dashboard_description: dto.dashboard_description,
      ...(student_hero_url && { student_dashboard_hero_image: student_hero_url }),
      ...(admin_hero_url && { dashboard_hero_image: admin_hero_url }),
    };

    await this.prisma.personalization.upsert({
      where: { user_id },
      update: {
        title_space: dto.title_space,
        languages: dto.languages,
        select_mode: dto.select_mode,
        bg_color: dto.bg_color,
        primary_color: dto.primary_color,
        secondary_color: dto.secondary_color,
        bg_color_dark: dto.bg_color_dark,
        font_family: dto.font_family,
        is_show_sidebar_icon: dto.is_show_sidebar_icon,
        is_white_sidebar_color: dto.is_white_sidebar_color,
        currency: dto.currency,
        ...(icon_url && { icon: icon_url }),
        dashboard_personalization: {
          upsert: {
            create: dashboard_data,
            update: dashboard_data,
          },
        },
      },
      create: {
        user_id,
        title_space: dto.title_space,
        languages: dto.languages,
        select_mode: dto.select_mode,
        bg_color: dto.bg_color,
        primary_color: dto.primary_color,
        secondary_color: dto.secondary_color,
        bg_color_dark: dto.bg_color_dark,
        font_family: dto.font_family,
        is_show_sidebar_icon: dto.is_show_sidebar_icon,
        is_white_sidebar_color: dto.is_white_sidebar_color,
        currency: dto.currency,
        ...(icon_url && { icon: icon_url }),
        dashboard_personalization: {
          create: dashboard_data,
        },
      },
    });

    return { message: 'space_settings_saved' };
  }
}
