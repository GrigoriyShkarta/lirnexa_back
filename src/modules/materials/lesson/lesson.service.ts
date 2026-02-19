import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonQueryDto } from './dto/lesson-query.dto';
import { Role } from '@prisma/client';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userRole: Role, dto: CreateLessonDto) {
    let super_admin_id: string | null = null;

    if (userRole === Role.super_admin) {
      super_admin_id = userId;
    } else if (userRole === Role.teacher || userRole === Role.admin) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { super_admin_id: true },
      });
      super_admin_id = user?.super_admin_id || null;
    }

    const { category_id, category_ids: categories, content, course_ids, ...lessonData } = dto;
    const finalCategories = categories || category_id;

    const lesson = await this.prisma.lesson.create({
      data: {
        ...lessonData,
        content: JSON.parse(content),
        author_id: userId,
        super_admin_id,
        categories: finalCategories ? { connect: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) } : undefined,
      },
    });

    if (course_ids && course_ids.length > 0) {
      await this.addLessonToCourses(lesson.id, course_ids);
    }

    return lesson;
  }

  async get_all(userId: string, query: LessonQueryDto) {
    const { search, page = 1, limit = 10, category_ids } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { author_id: userId },
        { super_admin_id: userId },
      ],
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (category_ids && category_ids.length > 0) {
      where.categories = {
        some: {
          id: { in: category_ids },
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.lesson.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          categories: true,
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    // Backward compatibility: add 'category' field (the first one from categories array)
    const dataWithFallback = data.map(item => ({
      ...item,
      category: item.categories?.[0] || null,
    }));

    return {
      data: dataWithFallback,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        categories: true,
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    return {
      ...lesson,
      category: lesson.categories?.[0] || null,
    };
  }

  async update(id: string, dto: UpdateLessonDto) {
    const { category_id, category_ids: categories, content, course_ids, ...lessonData } = dto;
    const data: any = { ...lessonData };
    
    if (content) {
      data.content = JSON.parse(content);
    }

    const finalCategories = categories || category_id;
    if (finalCategories) {
      data.categories = { set: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) };
    }

    const lesson = await this.prisma.lesson.update({
      where: { id },
      data,
    });

    if (course_ids && course_ids.length > 0) {
      await this.addLessonToCourses(lesson.id, course_ids);
    }

    return lesson;
  }

  async remove(id: string) {
    return this.prisma.lesson.delete({
      where: { id },
    });
  }

  async remove_bulk(ids: string[]) {
    return this.prisma.lesson.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  private async addLessonToCourses(lessonId: string, courseIds: string[]) {
    for (const courseId of courseIds) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { content: true }
      });

      if (!course) continue;

      const content = Array.isArray(course.content) ? [...course.content] : [];
      
      // Check if lesson already exists in course to avoid duplicates if needed, 
      // but user specifically said "add to the end", usually implies every time or just once.
      // We'll check by lesson_id to prevent redundant blocks for the same lesson.
      const exists = content.some((item: any) => item.type === 'lesson' && item.lesson_id === lessonId);
      if (exists) continue;

      content.push({
        type: 'lesson',
        id: crypto.randomUUID(),
        lesson_id: lessonId
      });

      await this.prisma.course.update({
        where: { id: courseId },
        data: { content }
      });
    }
  }
}
