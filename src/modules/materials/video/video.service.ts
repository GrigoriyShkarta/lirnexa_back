import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { VideoQueryDto } from './dto/video-query.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Role, Prisma } from '@prisma/client';

import { ContentCleanupService } from '../content-cleanup.service';

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private contentCleanupService: ContentCleanupService,
  ) {}

  /**
   * Helper to get super_admin folder path.
   */
  private async get_storage_path(user_id: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, role: true, super_admin_id: true, name: true },
    });

    if (!user) throw new NotFoundException('User not found');

    let super_admin_id = user.id;
    let super_admin_name = user.name;

    if (user.role !== Role.super_admin) {
      super_admin_id = user.super_admin_id || user.id;
      const sa = await this.prisma.user.findUnique({
        where: { id: super_admin_id },
        select: { name: true },
      });
      super_admin_name = sa?.name || 'admin';
    }

    const sanitized_sa_name = super_admin_name.replace(/\s+/g, '_');
    return `${sanitized_sa_name}${super_admin_id}/materials/video`;
  }

  private async get_super_admin_id(user_id: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, role: true, super_admin_id: true },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.role === Role.super_admin) {
      return user.id;
    }

    return user.super_admin_id || user.id;
  }

  /**
   * Retrieves all videos with pagination and search.
   */
  async get_all(user_id: string, query: VideoQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search;
    const category_ids = query.category_ids;
    
    const skip = (page - 1) * limit;

    const super_admin_id = await this.get_super_admin_id(user_id);

    const where: Prisma.VideoWhereInput = {
      super_admin_id: super_admin_id,
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (category_ids && category_ids.length > 0) {
      where.categories = {
        some: {
          id: { in: category_ids },
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { categories: true },
      }),
      this.prisma.video.count({ where }),
    ]);

    // Backward compatibility: add 'category' field (the first one from categories array)
    const dataWithFallback = data.map(item => ({
      ...item,
      category: item.categories?.[0] || null,
    }));

    return {
      data: dataWithFallback,
      meta: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
      },
    };
  }

  /**
   * Creates multiple videos.
   * Handles both files and links.
   */
  async create_bulk(requester_id: string, names: string | string[], urls: string | string[], files: Express.Multer.File[], category_ids?: string | string[]) {
    const nameArray = Array.isArray(names) ? names : names ? [names] : [];
    const urlArray = Array.isArray(urls) ? urls : urls ? [urls] : [];

    if (nameArray.length === 0) {
      throw new BadRequestException('names_required');
    }

    const createdVideos: any[] = [];
    const superAdminId = await this.get_super_admin_id(requester_id);
    const folderPath = await this.get_storage_path(requester_id);

    let fileIndex = 0;

    for (let i = 0; i < nameArray.length; i++) {
       const name = nameArray[i];
       const linkUrl = urlArray[i];

       let fileUrl = '';
       let fileKey: string | null = null;
       let isLink = false;

       if (linkUrl && linkUrl.trim() !== '') {
         // It is a link
         fileUrl = linkUrl;
         isLink = true;
       } else if (files && files[fileIndex]) {
         // It is a file upload
         const file = files[fileIndex++];
         fileUrl = await this.storageService.uploadFile(file, folderPath);
         fileKey = fileUrl;
         isLink = false;
       } else {
         // No link and no file for this name - skip or throw error
         continue;
       }

       const video = await this.prisma.video.create({
         data: {
           name: name,
           file_url: fileUrl,
           file_key: fileKey,
           is_link: isLink,
           super_admin_id: superAdminId,
           categories: category_ids ? { connect: (Array.isArray(category_ids) ? category_ids : [category_ids]).map(id => ({ id })) } : undefined,
         },
       });
       createdVideos.push(video);
    }

    return { message: 'videos_created_successfully', data: createdVideos };
  }

  /**
   * Updates a single video (name, file or link).
   */
  async update_video(requester_id: string, id: string, dto: UpdateVideoDto, file?: Express.Multer.File) {
    const video = await this.prisma.video.findUnique({ where: { id } });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const superAdminId = await this.get_super_admin_id(requester_id);
    if (video.super_admin_id !== superAdminId) {
       throw new BadRequestException('Access denied');
    }

    const updateData: Prisma.VideoUpdateInput = {
      name: dto.name,
      categories: dto.categories ? { set: (Array.isArray(dto.categories) ? dto.categories : [dto.categories]).map(id => ({ id })) } : undefined,
    };

    if (dto.url && dto.url.trim() !== '') {
      // Switch or update to link
      if (video.file_key && !video.is_link) {
        await this.storageService.deleteFile(video.file_key);
      }
      updateData.file_url = dto.url;
      updateData.file_key = null;
      updateData.is_link = true;
    } else if (file) {
      // Upload new file
      if (video.file_key && !video.is_link) {
        await this.storageService.deleteFile(video.file_key);
      }

      const folderPath = await this.get_storage_path(requester_id);
      const fileUrl = await this.storageService.uploadFile(file, folderPath);
      
      updateData.file_url = fileUrl;
      updateData.file_key = fileUrl;
      updateData.is_link = false;
    }

    const updated = await this.prisma.video.update({
      where: { id },
      data: updateData,
    });

    return { message: 'video_updated_successfully', data: updated };
  }

  /**
   * Updates multiple videos.
   */
  async update_bulk(requester_id: string, ids: string | string[], names: string | string[], urls: string | string[], files: Express.Multer.File[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const nameArray = Array.isArray(names) ? names : [names];
    const urlArray = Array.isArray(urls) ? urls : [urls];
    
    const updatedVideos: any[] = [];
    let fileIndex = 0;

    for (let i = 0; i < idArray.length; i++) {
      const id = idArray[i];
      const name = nameArray[i];
      const url = urlArray[i];
      
      let file: Express.Multer.File | undefined = undefined;
      if (!url || url.trim() === '') {
        file = files && files[fileIndex] ? files[fileIndex++] : undefined;
      }

      const result = await this.update_video(requester_id, id, { name, url }, file);
      updatedVideos.push(result.data);
    }

    return { message: 'videos_updated_successfully', data: updatedVideos };
  }

  /**
   * Deletes a video.
   */
  async delete_video(requester_id: string, id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const superAdminId = await this.get_super_admin_id(requester_id);
    if (video.super_admin_id !== superAdminId) {
      throw new BadRequestException('Access denied');
    }

    // 1. Delete from Cloudflare if it's a file
    if (video.file_key && !video.is_link) {
      await this.storageService.deleteFile(video.file_key);
    }

    // 2. Cleanup from Lessons and Courses
    await this.contentCleanupService.cleanupMediaReferences([id], superAdminId);

    // 3. Delete from DB
    await this.prisma.video.delete({ where: { id } });

    return { message: 'video_deleted_successfully' };
  }

  /**
   * Deletes multiple videos.
   */
  async delete_bulk(requester_id: string, ids: string[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    const superAdminId = await this.get_super_admin_id(requester_id);

    // 1. Find all to get file keys and verify ownership
    const videos = await this.prisma.video.findMany({
      where: { 
        id: { in: idArray },
        super_admin_id: superAdminId,
      },
      select: { id: true, file_key: true, is_link: true }
    });

    if (videos.length !== idArray.length) {
      throw new BadRequestException('Some videos not found or access denied');
    }

    // 2. Delete from Cloudflare
    for (const video of videos) {
      if (video.file_key && !video.is_link) {
        await this.storageService.deleteFile(video.file_key);
      }
    }

    // 3. Cleanup from Lessons and Courses
    await this.contentCleanupService.cleanupMediaReferences(idArray, superAdminId);

    // 4. Delete from DB
    await this.prisma.video.deleteMany({
      where: { id: { in: idArray } }
    });

    return { message: 'videos_deleted_successfully' };
  }
}
