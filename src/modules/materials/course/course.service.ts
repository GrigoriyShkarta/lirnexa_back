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

    const { category_id, category_ids, test_ids, content, ...courseData } = dto;
    const finalCategories = category_ids || category_id;

    return this.prisma.course.create({
      data: {
        ...courseData,
        content: typeof content === 'string' ? JSON.parse(content) : content,
        author_id: userId,
        super_admin_id,
        categories: finalCategories ? { connect: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) } : undefined,
        tests: test_ids ? { connect: test_ids.map(id => ({ id })) } : undefined,
      },
    });
  }

  async get_all(userId: string, userRole: Role, query: CourseQueryDto) {
    const { search, page = 1, limit = 10, category_ids, from_student, student_id } = query;
    const skip = (page - 1) * limit;

    let where: any = {};
    const targetStudentId = student_id || (userRole === Role.student ? userId : null);

    // Base visibility logic
    if (userRole === Role.student) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { super_admin_id: true },
      });
      where.super_admin_id = user?.super_admin_id || null;
    } else {
      where.OR = [
        { author_id: userId },
        { super_admin_id: userId },
      ];
    }

    // 2. Add search and category filters
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (category_ids && category_ids.length > 0) {
      where.categories = { some: { id: { in: category_ids } } };
    }

    // 3. Filter only accessible courses if the requester is a student or from_student is true
    if ((userRole === Role.student || from_student) && targetStudentId) {
      const lessonAccesses = await this.prisma.materialAccess.findMany({
        where: { student_id: targetStudentId, material_type: 'lesson' },
        select: { lesson_id: true },
      });
      const accessibleLessonIds = lessonAccesses.map((a) => a.lesson_id).filter(Boolean) as string[];

      // Fetch IDs of courses that contain at least one accessible lesson
      const candidateCourses = await this.prisma.course.findMany({
        where,
        select: { id: true, content: true },
      });

      const filteredCourseIds = candidateCourses
        .filter((course) => {
          const content = Array.isArray(course.content) ? course.content : [];
          return content.some((item: any) => {
            if (item.type === 'lesson' && accessibleLessonIds.includes(item.lesson_id)) return true;
            if (item.type === 'group' && Array.isArray(item.lesson_ids) && item.lesson_ids.some((id: string) => accessibleLessonIds.includes(id))) return true;
            return false;
          });
        })
        .map((c) => c.id);

      where = { 
        id: { in: filteredCourseIds },
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
          tests: { select: { id: true, name: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // Backward compatibility
    const dataWithFallback = data.map(item => ({
      ...item,
      category: item.categories?.[0] || null,
      tests: item.tests.map(t => ({ ...t, title: t.name })),
    }));

    const enrichedData = await this.fillCoursesMetadata(targetStudentId, userRole, dataWithFallback);

    return {
      data: enrichedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string, userRole: Role, from_student?: boolean, student_id?: string) {
    const targetStudentId = student_id || userId;
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
        tests: { select: { id: true, name: true } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    const withFallback = {
      ...course,
      category: course.categories?.[0] || null,
      tests: course.tests.map(t => ({ ...t, title: t.name })),
    };

    const [enriched] = await this.fillCoursesMetadata(targetStudentId, userRole, [withFallback]);
    return enriched;
  }

  async update(id: string, dto: UpdateCourseDto) {
    const { category_id, category_ids, test_ids, content, ...courseData } = dto as any;
    const data: any = { ...courseData };

    if (content) {
      data.content = typeof content === 'string' ? JSON.parse(content) : content;
    }

    const finalCategories = category_ids || category_id;
    if (finalCategories) {
      data.categories = { set: (Array.isArray(finalCategories) ? finalCategories : [finalCategories]).map(id => ({ id })) };
    }

    if (test_ids) {
      data.tests = { set: test_ids.map(id => ({ id })) };
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

  private async fillCoursesMetadata(userId: string | null, userRole: Role, courses: any[]) {
    if (courses.length === 0) return courses;
    const isStudent = userRole === Role.student;

    // 1. Get all lesson IDs in these courses
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

    // 2. Fetch lesson and test details
    const allTestIds = new Set<string>();
    courses.forEach(course => {
      const content = Array.isArray(course.content) ? course.content : [];
      content.forEach((item: any) => {
        if (item.type === 'test' && item.test_id) {
          allTestIds.add(item.test_id);
        }
      });
    });

    const [lessons, tests] = await Promise.all([
      allLessonIds.size > 0 
        ? this.prisma.lesson.findMany({
            where: { id: { in: Array.from(allLessonIds) } },
            select: { id: true, duration: true, name: true }
          })
        : [],
      allTestIds.size > 0
        ? this.prisma.test.findMany({
            where: { id: { in: Array.from(allTestIds) } },
            select: { id: true, name: true }
          })
        : []
    ]);

    const lessonInfoMap = new Map<string, { duration: number; title: string }>(
      lessons.map(l => [l.id, { duration: l.duration || 0, title: l.name }] as const)
    );
    const testInfoMap = new Map<string, { title: string }>(
      tests.map(t => [t.id, { title: t.name }] as const)
    );

    // 3. Fetch student access info for these lessons and tests
    const [accesses, testAccesses] = (userId && (allLessonIds.size > 0 || allTestIds.size > 0))
      ? await Promise.all([
          allLessonIds.size > 0 
            ? this.prisma.materialAccess.findMany({
                where: {
                  student_id: userId,
                  material_type: 'lesson',
                  lesson_id: { in: Array.from(allLessonIds) }
                }
              })
            : [],
          allTestIds.size > 0
            ? this.prisma.materialAccess.findMany({
                where: {
                  student_id: userId,
                  material_type: 'test',
                  test_id: { in: Array.from(allTestIds) }
                }
              })
            : []
        ])
      : [[], []];

    const accessMap = new Map<string, any>(accesses.map(a => [a.lesson_id as string, a] as const));
    const testAccessMap = new Map<string, any>(testAccesses.map(a => [a.test_id as string, a] as const));

    // 3.5. Fetch test completion status for student
    const testAttempts = (userId && isStudent && allTestIds.size > 0)
      ? await this.prisma.testAttempt.findMany({
          where: {
            student_id: userId,
            test_id: { in: Array.from(allTestIds) },
            is_passed: true,
          },
          select: { test_id: true }
        })
      : [];
    const passedTestIds = new Set(testAttempts.map(a => a.test_id));

    // 4. Enrich courses
    return courses.map(course => {
      const content = Array.isArray(course.content) ? course.content : [];
      let totalDuration = 0;
      let totalItemsCount = 0;
      let accessibleItemsCount = 0;

      const enrichedContent = content.map((item: any) => {
        if (!item || typeof item !== 'object') return item;

        if (item.type === 'lesson' && item.lesson_id) {
          totalItemsCount++;
          const lessonInfo = lessonInfoMap.get(item.lesson_id);
          const duration = lessonInfo?.duration || 0;
          totalDuration += duration;
          
          const access = accessMap.get(item.lesson_id);
          if (access) accessibleItemsCount++;
          
          return {
            ...item,
            title: lessonInfo?.title || '',
            duration,
            has_access: !!access,
            access_type: access ? (access.full_access ? 'full' : 'partial') : 'none'
          };
        }

        if (item.type === 'test' && item.test_id) {
          totalItemsCount++;
          const testInfo = testInfoMap.get(item.test_id);
          const access = testAccessMap.get(item.test_id);
          if (access) accessibleItemsCount++;
          
          return {
            ...item,
            title: testInfo?.title || '',
            has_access: !!access,
            is_passed: isStudent ? passedTestIds.has(item.test_id) : true
          };
        }

        if (item.type === 'group' && Array.isArray(item.lesson_ids)) {
          const groupLessons = item.lesson_ids.map((id: string) => {
            totalItemsCount++;
            const lessonInfo = lessonInfoMap.get(id);
            const duration = lessonInfo?.duration || 0;
            totalDuration += duration;
            const access = accessMap.get(id);
            if (access) accessibleItemsCount++;
            
            return {
              lesson_id: id,
              title: lessonInfo?.title || '',
              duration,
              has_access: !!access,
              access_type: access ? (access.full_access ? 'full' : 'partial') : 'none'
            };
          });
          
          return {
            ...item,
            lessons: groupLessons
          };
        }
        
        return item;
      });

      return {
        ...course,
        content: enrichedContent,
        duration: totalDuration,
        has_access: accessibleItemsCount > 0,
        progress_percentage: totalItemsCount > 0 
          ? Math.round((accessibleItemsCount / totalItemsCount) * 100) 
          : 0
      };
    });
  }
}
