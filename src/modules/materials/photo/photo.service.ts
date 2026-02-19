import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { PhotoQueryDto } from './dto/photo-query.dto';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { Role, Prisma } from '@prisma/client';

import { ContentCleanupService } from '../content-cleanup.service';

@Injectable()
export class PhotoService {
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
    return `${sanitized_sa_name}${super_admin_id}/materials/photo`;
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
   * Retrieves all photos with pagination and search.
   */
  async get_all(user_id: string, query: PhotoQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search;
    const category_ids = query.category_ids;
    
    const skip = (page - 1) * limit;

    const super_admin_id = await this.get_super_admin_id(user_id);

    const where: Prisma.PhotoWhereInput = {
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
      this.prisma.photo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { categories: true },
      }),
      this.prisma.photo.count({ where }),
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
   * Creates multiple photos.
   * Handles multiple files and their corresponding names.
   */
  async create_bulk(requester_id: string, names: string | string[], files: Express.Multer.File[], category_ids?: string | string[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const nameArray = Array.isArray(names) ? names : names ? [names] : [];

    if (nameArray.length === 0) {
      throw new BadRequestException('names_required');
    }

    if (nameArray.length !== files.length) {
      throw new BadRequestException('numbers_of_names_and_files_do_not_match');
    }

    const createdPhotos: any[] = [];

    for (let i = 0; i < files.length; i++) {
       const file = files[i];
       const name = nameArray[i];

       // Upload to Cloudflare
       const folderPath = await this.get_storage_path(requester_id);
       const superAdminId = await this.get_super_admin_id(requester_id);
       const fileUrl = await this.storageService.uploadFile(file, folderPath);
       
        const photo = await this.prisma.photo.create({
          data: {
            name: name,
            file_url: fileUrl,
            file_key: fileUrl,
            super_admin_id: superAdminId,
            categories: category_ids ? { connect: (Array.isArray(category_ids) ? category_ids : [category_ids]).map(id => ({ id })) } : undefined,
          },
        });
       createdPhotos.push(photo);
    }

    return { message: 'photos_created_successfully', data: createdPhotos };
  }

  /**
   * Updates a single photo (name and/or file).
   */
  async update_photo(requester_id: string, id: string, dto: UpdatePhotoDto, file?: Express.Multer.File) {
    const photo = await this.prisma.photo.findUnique({ where: { id } });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const superAdminId = await this.get_super_admin_id(requester_id);
    if (photo.super_admin_id !== superAdminId) {
       throw new BadRequestException('Access denied');
    }

    const updateData: Prisma.PhotoUpdateInput = {
      name: dto.name,
      categories: dto.categories ? { set: (Array.isArray(dto.categories) ? dto.categories : [dto.categories]).map(id => ({ id })) } : undefined,
    };

    if (file) {
      // Delete old file
      await this.storageService.deleteFile(photo.file_key);

      // Upload new file
      const folderPath = await this.get_storage_path(requester_id);
      const fileUrl = await this.storageService.uploadFile(file, folderPath);
      
      updateData.file_url = fileUrl;
      updateData.file_key = fileUrl;
    }

    const updated = await this.prisma.photo.update({
      where: { id },
      data: updateData,
    });

    return { message: 'photo_updated_successfully', data: updated };
  }

  /**
   * Updates multiple photos.
   */
  async update_bulk(requester_id: string, ids: string | string[], names: string | string[], files: Express.Multer.File[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];
    const nameArray = Array.isArray(names) ? names : [names];
    
    const updatedPhotos: any[] = [];

    for (let i = 0; i < idArray.length; i++) {
      const id = idArray[i];
      const name = nameArray[i];
      const file = files && files[i] ? files[i] : undefined;

      const result = await this.update_photo(requester_id, id, { name }, file);
      updatedPhotos.push(result.data);
    }

    return { message: 'photos_updated_successfully', data: updatedPhotos };
  }

  /**
   * Deletes a photo.
   */
  async delete_photo(requester_id: string, id: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id } });

    if (!photo) {
      throw new NotFoundException('Photo not found');
    }

    const superAdminId = await this.get_super_admin_id(requester_id);
    if (photo.super_admin_id !== superAdminId) {
      throw new BadRequestException('Access denied');
    }

    // 1. Delete from Cloudflare
    await this.storageService.deleteFile(photo.file_key);

    // 2. Cleanup from Lessons and Courses
    await this.contentCleanupService.cleanupMediaReferences([id], superAdminId);

    // 3. Delete from DB
    await this.prisma.photo.delete({ where: { id } });

    return { message: 'photo_deleted_successfully' };
  }

  /**
   * Deletes multiple photos.
   */
  async delete_bulk(requester_id: string, ids: string[]) {
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    const superAdminId = await this.get_super_admin_id(requester_id);

    // 1. Find all to get file keys and verify ownership
    const photos = await this.prisma.photo.findMany({
      where: { 
        id: { in: idArray },
        super_admin_id: superAdminId,
      },
      select: { id: true, file_key: true }
    });

    if (photos.length !== idArray.length) {
      throw new BadRequestException('Some photos not found or access denied');
    }

    // 2. Delete from Cloudflare
    for (const photo of photos) {
      await this.storageService.deleteFile(photo.file_key);
    }

    // 3. Cleanup from Lessons and Courses
    await this.contentCleanupService.cleanupMediaReferences(idArray, superAdminId);

    // 4. Delete from DB
    await this.prisma.photo.deleteMany({
      where: { id: { in: idArray } }
    });

    return { message: 'photos_deleted_successfully' };
  }
}
