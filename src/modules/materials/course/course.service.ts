import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseQueryDto } from './dto/course-query.dto';
import { Role } from '@prisma/client';

@Injectable()
export class CourseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, userRole: Role, dto: CreateCourseDto) {
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

    const { category_id, category_ids, content, ...courseData } = dto;
    const finalCategories = category_ids || category_id;

    return this.prisma.course.create({
      data: {
        ...courseData,
        content: typeof content === 'string' ? JSON.parse(content) : content,
        author_id: userId,
        super_admin_id,
        categories: finalCategories ? { connect: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) } : undefined,
      },
    });
  }

  async get_all(userId: string, query: CourseQueryDto) {
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
      this.prisma.course.findMany({
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
      this.prisma.course.count({ where }),
    ]);

    // Backward compatibility: add 'category' field (the first one from categories array)
    const dataWithFallback = data.map(item => ({
      ...item,
      category: item.categories?.[0] || null,
    }));

    const dataWithDuration = await this.fillCoursesDuration(dataWithFallback);

    return {
      data: dataWithDuration,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
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

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    const withFallback = {
      ...course,
      category: course.categories?.[0] || null,
    };

    const [withDuration] = await this.fillCoursesDuration([withFallback]);
    return withDuration;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const { category_id, category_ids, content, ...courseData } = dto;
    const data: any = { ...courseData };

    if (content) {
      data.content = typeof content === 'string' ? JSON.parse(content) : content;
    }

    const finalCategories = category_ids || category_id;
    if (finalCategories) {
      data.categories = { set: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) };
    }

    return this.prisma.course.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.course.delete({
      where: { id },
    });
  }

  async remove_bulk(ids: string[]) {
    return this.prisma.course.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  private async fillCoursesDuration(courses: any[]) {
    const allLessonIds = new Set<string>();
    courses.forEach(course => {
      const content = Array.isArray(course.content) ? course.content : [];
      content.forEach((item: any) => {
        if (item.type === 'lesson' && item.lesson_id) {
          allLessonIds.add(item.lesson_id);
        } else if (item.type === 'group' && Array.isArray(item.lesson_ids)) {
          item.lesson_ids.forEach((id: string) => allLessonIds.add(id));
        }
      });
    });

    if (allLessonIds.size === 0) {
      return courses.map(c => ({ ...c, duration: 0 }));
    }

    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: Array.from(allLessonIds) } },
      select: { id: true, duration: true }
    });

    const durationMap = new Map(lessons.map(l => [l.id, l.duration || 0]));

    return courses.map(course => {
      const content = Array.isArray(course.content) ? course.content : [];
      let totalDuration = 0;
      content.forEach((item: any) => {
        if (item.type === 'lesson' && item.lesson_id) {
          totalDuration += durationMap.get(item.lesson_id) || 0;
        } else if (item.type === 'group' && Array.isArray(item.lesson_ids)) {
          item.lesson_ids.forEach((id: string) => {
            totalDuration += durationMap.get(id) || 0;
          });
        }
      });
      return { ...course, duration: totalDuration };
    });
  }
}
