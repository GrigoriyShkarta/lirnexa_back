import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Role, Prisma } from '@prisma/client';
import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userRole: Role, dto: CreateCategoryDto | CreateCategoryDto[]) {
    let super_admin_id: string | null = null;

    if (userRole === Role.super_admin) {
      super_admin_id = userId;
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { super_admin_id: true },
      });
      super_admin_id = user?.super_admin_id || null;
    }

    if (Array.isArray(dto)) {
      const data = dto.map(item => ({
        name: item.name!,
        color: item.color,
        super_admin_id,
      }));
      await this.prisma.category.createMany({ data });
      // createMany does not return the created records, so we fetch them or return success message
      // For simplicity/API consistency, we might just return what we can
      return { message: 'Categories created successfully', count: data.length };
    } else {
       // Check if new structure with categories array is used
       if (dto.categories && Array.isArray(dto.categories)) {
         const data = dto.categories.map(item => ({
            name: item.name,
            color: item.color,
            super_admin_id,
          }));
          await this.prisma.category.createMany({ data });
          return { message: 'Categories created successfully', count: data.length };
       }

      // Backward compatibility for single object without categories array
      return this.prisma.category.create({
        data: {
          name: dto.name!,
          color: dto.color,
          super_admin_id,
        },
      });
    }
  }

  async get_all(userId: string, query: CategoryQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { super_admin_id: true, role: true },
    });
    
    const super_admin_id = user?.role === Role.super_admin ? userId : user?.super_admin_id;

    const where: Prisma.CategoryWhereInput = {
      super_admin_id: super_admin_id,
    };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data,
      meta: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
      },
    };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    return this.prisma.category.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.category.delete({
      where: { id },
    });
  }

  async remove_bulk(ids: string[]) {
    return this.prisma.category.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }
}
