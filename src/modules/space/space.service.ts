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
      };
    }

    return space;
  }

  /**
   * Saves space settings for a super_admin.
   * @param user_id Current user ID (must be super_admin).
   * @param dto Space settings data.
   * @param icon_file Optional uploaded icon file.
   */
  async save_space(
    user_id: string,
    dto: SafeSpaceDto,
    icon_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { name: true, id: true, personalization: { select: { icon: true } } },
    });

    if (!user) {
      throw new NotFoundException('user_not_found');
    }

    let icon_url: string | undefined;

    if (icon_file) {
      // If there is an old icon, delete it
      if (user.personalization?.icon && user.personalization.icon !== '') {
        await this.storageService.deleteFile(user.personalization.icon);
      }

      // Folder: name+uuid/space (sanitized name)
      const sanitized_name = user.name.replace(/\s+/g, '_');
      const folder_path = `${sanitized_name}${user.id}/space`;
      icon_url = await this.storageService.uploadFile(icon_file, folder_path);
    }

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
        ...(icon_url && { icon: icon_url }),
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
        ...(icon_url && { icon: icon_url }),
      },
    });

    return { message: 'space_settings_saved' };
  }
}
