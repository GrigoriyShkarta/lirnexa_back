import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonQueryDto } from './dto/lesson-query.dto';
import { Role } from '@prisma/client';

import { AccessService } from '../access/access.service';

@Injectable()
export class LessonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Create a new lesson
   * @param userId - ID of the user creating the lesson
   * @param userRole - Role of the creator
   * @param dto - Lesson data
   * @returns Created lesson
   */
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

    const { category_id, category_ids: categories, content, course_ids, homework_name, homework_content, homework_id, ...lessonData } = dto;
    const finalCategories = categories || category_id;

    const lesson = await this.prisma.lesson.create({
      data: {
        ...lessonData,
        content: JSON.parse(content),
        author_id: userId,
        super_admin_id,
        categories: finalCategories ? { connect: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) } : undefined,
        homework: homework_id ? {
          connect: { id: homework_id }
        } : (homework_name && homework_content) ? {
          create: {
            name: homework_name,
            content: JSON.parse(homework_content),
            author_id: userId,
            super_admin_id,
          }
        } : undefined,
      },
    });

    if (course_ids && course_ids.length > 0) {
      await this.addLessonToCourses(lesson.id, course_ids);
    }

    return lesson;
  }

  /**
   * Get all lessons with pagination and filters
   * @param userId - ID of the user requesting the lessons
   * @param userRole - Role of the user
   * @param query - Query parameters for search, pagination and filtering
   * @returns Paginated list of lessons
   */
  async get_all(userId: string, userRole: Role, query: LessonQueryDto) {
    const { search, page = 1, limit = 10, category_ids, from_student, student_id } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    const isStudent = userRole === Role.student;
    const targetStudentId = student_id || userId;

    if (isStudent || from_student) {
      where.access = {
        some: {
          student_id: targetStudentId,
          material_type: 'lesson',
        },
      };
    } else {
      where.OR = [
        { author_id: userId },
        { super_admin_id: userId },
      ];
    }

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
          access: {
            select: {
              student_id: true,
              full_access: true,
              accessible_blocks: true,
            },
          },
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    // Backward compatibility: add 'category' field and map access to student IDs
    const dataWithFallback = data.map(item => {
      const studentAccess = student_id ? item.access.find(a => a.student_id === student_id) : null;
      return {
        ...item,
        category: item.categories?.[0] || null,
        accessible_student_ids: (item as any).access?.map((a: any) => a.student_id) || [],
        has_access: !!studentAccess,
        full_access: studentAccess ? (studentAccess as any).full_access : false,
        accessible_blocks: studentAccess ? (studentAccess as any).accessible_blocks : [],
      };
    });

    const dataWithCourses = await this.fillLessonsWithCourses(userId, dataWithFallback);

    return {
      data: dataWithCourses,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single lesson by ID with its relations and access control
   * @param id - Lesson ID
   * @param userId - ID of the user requesting the lesson
   * @param userRole - Role of the user
   * @param from_student - Whether the request is from a student view
   * @param student_id - Optional student ID for access check
   * @returns Detailed lesson with relations
   */
  async findOne(id: string, userId: string, userRole: Role, from_student?: boolean, student_id?: string) {
    const isStudent = userRole === Role.student;
    const targetStudentId = student_id || userId;
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
        homework: {
          include: {
            submissions: (from_student || student_id || isStudent) ? {
              where: { student_id: targetStudentId },
              take: 1,
            } : false,
          }
        },
        categories: true,
        access: (from_student || student_id || isStudent) ? {
          where: {
            student_id: targetStudentId,
            material_type: 'lesson',
          }
        } : false,
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${id} not found`);
    }

    // Handle access info
    let accessibleBlocks: string[] = [];
    let isFullAccess = false;

    if (from_student || student_id || isStudent) {
      const userAccess = (lesson as any).access?.[0];
      
      if ((from_student || isStudent) && !userAccess) {
        throw new ForbiddenException(`access_denied_lesson`);
      }

      if (userAccess) {
        accessibleBlocks = userAccess.accessible_blocks || [];
        isFullAccess = userAccess.full_access;

        // Only filter content if it's a direct student request
        if (from_student && !isFullAccess) {
          const content = lesson.content as any[];
          if (Array.isArray(content)) {
            lesson.content = content.filter((block: any) => 
              accessibleBlocks.includes(block.id)
            );
          }
        }
      }
    }

    // Handle homework status
    let homework_status = lesson.homework ? 'not_submitted' : undefined;
    // any used here because of dynamically included nested submissions in Prisma query
    if (lesson.homework && (lesson.homework as any).submissions?.length > 0) {
      homework_status = (lesson.homework as any).submissions[0].status;
    }

    const withFallback = {
      ...lesson,
      category: lesson.categories?.[0] || null,
      accessible_blocks: accessibleBlocks,
      full_access: isFullAccess,
      homework_status,
    };

    const [withCourses] = await this.fillLessonsWithCourses(
      lesson.author_id,
      [withFallback],
    );
    return withCourses;
  }

  /**
   * Update an existing lesson
   * @param id - Lesson ID
   * @param userId - ID of the user updating the lesson
   * @param dto - Updated data
   * @returns Updated lesson
   */
  async update(id: string, userId: string, dto: UpdateLessonDto) {
    const { category_id, category_ids: categories, content, course_ids, homework_name, homework_content, homework_id, ...lessonData } = dto;
    const data: any = { ...lessonData };
    
    if (content) {
      data.content = JSON.parse(content);
    }

    const finalCategories = categories || category_id;
    if (finalCategories) {
      data.categories = { set: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) };
    }

    if (homework_id) {
       data.homework = { connect: { id: homework_id } };
    }

    const lesson = await this.prisma.lesson.update({
      where: { id },
      data,
      include: {
        super_admin: { select: { id: true } }
      }
    });

    if (homework_name || homework_content) {
      const super_admin_id = lesson.super_admin_id;

      await this.prisma.homework.upsert({
        where: { lesson_id: lesson.id },
        update: {
          ...(homework_name && { name: homework_name }),
          ...(homework_content && { content: JSON.parse(homework_content) }),
        },
        create: {
          name: homework_name || 'Homework',
          content: homework_content ? JSON.parse(homework_content) : [],
          lesson_id: lesson.id,
          author_id: userId,
          super_admin_id,
        }
      });
    }

    if (content) {
      await this.accessService.sync_lesson_materials_access(lesson.id);
    }

    if (course_ids && course_ids.length > 0) {
      await this.addLessonToCourses(lesson.id, course_ids);
    }

    return lesson;
  }

  /**
   * Delete a lesson
   * @param id - Lesson ID
   * @returns Deleted lesson
   */
  async remove(id: string) {
    await this.cleanupLessonsInCourses([id]);
    return this.prisma.lesson.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple lessons
   * @param ids - Array of lesson IDs
   * @returns Result of deletion
   */
  async remove_bulk(ids: string[]) {
    await this.cleanupLessonsInCourses(ids);
    return this.prisma.lesson.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  private async cleanupLessonsInCourses(lessonIds: string[]) {
    if (!lessonIds.length) return;

    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: { super_admin_id: true }
    });

    const superAdminIds = [...new Set(lessons.map(l => l.super_admin_id).filter(Boolean))];

    if (!superAdminIds.length) return;

    const courses = await this.prisma.course.findMany({
      where: { super_admin_id: { in: superAdminIds as string[] } },
      select: { id: true, content: true }
    });

    for (const course of courses) {
      const content = Array.isArray(course.content) ? (course.content as any[]) : [];
      let modified = false;

      const newContent = content.map(item => {
        if (item.type === 'lesson') {
          if (lessonIds.includes(item.lesson_id)) {
            modified = true;
            return null;
          }
        } else if (item.type === 'group' && Array.isArray(item.lesson_ids)) {
          const originalLength = item.lesson_ids.length;
          const filteredIds = item.lesson_ids.filter(id => !lessonIds.includes(id));
          if (filteredIds.length !== originalLength) {
            modified = true;
            item.lesson_ids = filteredIds;
          }
        }
        return item;
      }).filter(Boolean);

      if (modified) {
        await this.prisma.course.update({
          where: { id: course.id },
          data: { content: newContent }
        });
      }
    }
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


  private async fillLessonsWithCourses(userId: string, lessons: any[]) {
    if (lessons.length === 0) return lessons;

    const allCourses = await this.prisma.course.findMany({
      where: {
        OR: [{ author_id: userId }, { super_admin_id: userId }],
      },
      select: { id: true, name: true, content: true },
    });

    return lessons.map((lesson) => {
      const parentCourses = allCourses.filter((course) => {
        const content = Array.isArray(course.content) ? course.content : [];
        return content.some((item: any) => {
          if (item.type === 'lesson' && item.lesson_id === lesson.id) {
            return true;
          }
          if (
            item.type === 'group' &&
            Array.isArray(item.lesson_ids) &&
            item.lesson_ids.includes(lesson.id)
          ) {
            return true;
          }
          return false;
        });
      });

      return {
        ...lesson,
        courses: parentCourses.map((c) => ({ id: c.id, name: c.name })),
      };
    });
  }
}
