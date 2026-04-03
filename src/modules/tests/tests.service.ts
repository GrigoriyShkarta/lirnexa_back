import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, TestStatus, Prisma } from '@prisma/client';
import {
  CreateTestDto,
  UpdateTestDto,
  SubmitAttemptDto,
  TestResponseDto,
  AttemptResponseDto,
} from './dto/tests.dto';
import { TestQueryDto } from './dto/test-query.dto';

@Injectable()
/**
 * Service responsible for Test CRUD and student attempts.
 */
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Test CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new test.
   */
  async create(
    dto: CreateTestDto,
    author_id: string,
    author_role: Role,
  ): Promise<TestResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: author_id },
      select: { super_admin_id: true },
    });

    if (!user) throw new NotFoundException('user_not_found');

    const super_admin_id =
      author_role === Role.super_admin ? author_id : user.super_admin_id;

    try {
      const test = await this.prisma.test.create({
        data: {
          name: dto.name,
          description: dto.description || '',
          settings: dto.settings as unknown as Prisma.InputJsonValue,
          content: dto.content as unknown as Prisma.InputJsonValue,
          author_id,
          super_admin_id,
          categories: {
            connect: dto.category_ids.map((id) => ({ id })),
          },
          courses: dto.course_ids && dto.course_ids.length > 0 
            ? { connect: dto.course_ids.map(id => ({ id })) } 
            : undefined,
        },
        include: {
          categories: true,
        },
      });

      if (dto.course_ids && dto.course_ids.length > 0) {
        await this.addTestToCourses(test.id, dto.course_ids);
      }

      return { ...test, title: test.name } as unknown as TestResponseDto;
    } catch (error) {
      this.handle_error(error, 'create');
    }
  }

  /**
   * Updates test metadata and content.
   */
  async update(
    test_id: string,
    dto: UpdateTestDto,
    requester_id: string,
    requester_role: Role,
  ): Promise<TestResponseDto> {
    const test = await this.find_test_or_throw(test_id);
    await this.check_test_ownership(test, requester_id, requester_role);

    try {
      const updated = await this.prisma.test.update({
        where: { id: test_id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.settings !== undefined && { settings: dto.settings as any }),
          ...(dto.content !== undefined && { content: dto.content as any }),
          ...(dto.category_ids !== undefined && {
            categories: {
              set: dto.category_ids.map((id) => ({ id })),
            },
          }),
          ...(dto.course_ids !== undefined && {
            courses: {
              set: dto.course_ids.map((id) => ({ id })),
            },
          }),
        },
        include: {
          categories: true,
        },
      });

      if (dto.course_ids && dto.course_ids.length > 0) {
        await this.addTestToCourses(updated.id, dto.course_ids);
      }

      return { ...updated, title: updated.name } as unknown as TestResponseDto;
    } catch (error) {
      this.handle_error(error, 'update');
    }
  }

  /**
   * Deletes a test.
   */
  async delete(
    test_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<{ message: string }> {
    const test = await this.find_test_or_throw(test_id);
    await this.check_test_ownership(test, requester_id, requester_role);

    try {
      await this.prisma.test.delete({ where: { id: test_id } });
      return { message: 'test_deleted' };
    } catch (error) {
      this.handle_error(error, 'delete');
    }
  }

  /**
   * Finds a single test.
   */
  async find_one(
    test_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<TestResponseDto> {
    const test = await this.prisma.test.findUnique({
      where: { id: test_id },
      include: { categories: true },
    });

    if (!test) throw new NotFoundException('test_not_found');
    await this.check_test_access(test, requester_id, requester_role);

    const response: any = { ...test, title: test.name };

    if (requester_role === Role.student) {
      const last_attempt = await this.prisma.testAttempt.findFirst({
        where: { test_id, student_id: requester_id },
        orderBy: { created_at: 'desc' },
      });

      if (last_attempt) {
        response.last_attempt = this.map_attempt_to_dto(last_attempt);
        response.is_passed = last_attempt.is_passed;
      }
    }

    return response as TestResponseDto;
  }

  /**
   * Finds all tests with pagination and filtering.
   */
  async find_all(requester_id: string, requester_role: Role, query: TestQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const search = query.search;
    const category_ids = query.category_ids;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({
      where: { id: requester_id },
      select: { super_admin_id: true },
    });

    if (!user) throw new NotFoundException('user_not_found');

    const super_admin_id =
      requester_role === Role.super_admin ? requester_id : user.super_admin_id || requester_id;

    const targetStudentId = query.student_id || requester_id;
    const isStudent = requester_role === Role.student;

    const where: Prisma.TestWhereInput = {
      super_admin_id: super_admin_id,
    };

    if (isStudent || query.from_student) {
      where.access = {
        some: {
          student_id: targetStudentId,
          material_type: 'test',
        },
      };
    }

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
      this.prisma.test.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          categories: true,
          access: {
            select: {
              student_id: true,
            },
          },
        },
      }),
      this.prisma.test.count({ where }),
    ]);

    const student_attempts = isStudent || query.from_student
      ? await this.prisma.testAttempt.findMany({
          where: {
            student_id: targetStudentId,
            test_id: { in: data.map((t) => t.id) },
          },
          orderBy: { created_at: 'desc' },
        })
      : [];

    const dataWithFallback = data.map((item) => {
      const attempts = student_attempts.filter((a) => a.test_id === item.id);
      const last_attempt = attempts[0]; // Already ordered by desc

      return {
        ...item,
        title: item.name,
        category: item.categories?.[0] || null,
        accessible_student_ids: (item as any).access?.map((a: any) => a.student_id) || [],
        has_access: (item as any).access?.some((a: any) => a.student_id === targetStudentId) || false,
        is_passed: attempts.some((a) => a.is_passed),
        last_attempt: last_attempt ? this.map_attempt_to_dto(last_attempt) : null,
      };
    });

    return {
      data: dataWithFallback,
      meta: {
        current_page: page,
        total_pages: Math.ceil(total / limit),
        total_items: total,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Test Attempts
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Starts a new test attempt for a student.
   */
  async start_attempt(
    test_id: string,
    student_id: string,
    requester_role: Role,
  ): Promise<AttemptResponseDto> {
    const test = await this.find_test_or_throw(test_id);
    await this.check_test_access(test, student_id, requester_role);

    try {
      const attempt = await this.prisma.testAttempt.create({
        data: {
          test_id,
          student_id,
          status: TestStatus.in_progress,
          started_at: new Date(),
        },
      });

      return { ...attempt, test_name: test.name } as unknown as AttemptResponseDto;
    } catch (error) {
      this.handle_error(error, 'start_attempt');
    }
  }

  /**
   * Submits and evaluates a test attempt.
   */
  async submit_attempt(
    attempt_id: string,
    dto: SubmitAttemptDto,
    student_id: string,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attempt_id },
      include: { test: true },
    });

    if (!attempt) throw new NotFoundException('attempt_not_found');
    if (attempt.student_id !== student_id) throw new ForbiddenException('unauthorized');
    if (attempt.status !== TestStatus.in_progress) {
      throw new BadRequestException('attempt_already_completed');
    }

    const test_content = attempt.test.content as any[];
    const result = this.calculate_detailed_score(test_content, dto.answers);
    
    // Check if there are any detailed answers that need review
    const has_pending = test_content.some(q => q.type === 'detailed_answer');
    const status = has_pending ? TestStatus.pending_review : TestStatus.completed;

    try {
      const updated = await this.prisma.testAttempt.update({
        where: { id: attempt_id },
        data: {
          answers: result.processed_answers as any,
          score: result.score,
          total_points: result.total_points,
          time_spent: dto.time_spent,
          status,
          completed_at: new Date(),
          is_passed:
            (attempt.test.settings as any).passing_score !== undefined
              ? (result.score / (result.total_points || 1)) * 100 >=
                (attempt.test.settings as any).passing_score
              : true,
        },
        include: {
          test: { select: { name: true, id: true } },
          student: { select: { name: true, avatar: true, super_admin_id: true, teacher_id: true, id: true } },
        },
      });

      // Create notifications for admin and teacher
      const { student, test } = updated;
      const recipients = new Set<string>();
      if (student.super_admin_id) recipients.add(student.super_admin_id);
      if (student.teacher_id) recipients.add(student.teacher_id);

      for (const recipient_id of recipients) {
        await this.prisma.notification.create({
          data: {
            user_id: recipient_id,
            message_id: student.id,
            message_title: student.name,
            message_type: 'test',
            message: 'test_completed',
            payload: {
              test_id: test.id,
              test_name: test.name,
              student_id: student.id,
              student_name: student.name,
              attempt_id: updated.id,
              score: updated.score,
              total_points: updated.total_points,
              status: updated.status,
            },
          },
        });
      }

      return this.map_attempt_to_dto(updated);
    } catch (error) {
      this.handle_error(error, 'submit_attempt');
    }
  }

  /**
   * Gets all attempts for a specific student or test.
   */
  async find_attempts(
    student_id?: string,
    test_id?: string,
  ): Promise<AttemptResponseDto[]> {
    const attempts = await this.prisma.testAttempt.findMany({
      where: {
        ...(student_id && { student_id }),
        ...(test_id && { test_id }),
      },
      orderBy: { created_at: 'desc' },
      include: { 
        test: { select: { name: true } },
        student: { select: { name: true, avatar: true } }
      },
    });

    return attempts.map((a) => this.map_attempt_to_dto(a));
  }

  /**
   * Find paginated attempts for a test.
   */
  async find_attempts_paginated(
    test_id?: string,
    page = 1,
    limit = 15,
    status?: string,
  ) {
    const where = {
      ...(test_id && { test_id }),
      ...(status && { status: status as TestStatus }),
    };

    const [total_items, data] = await Promise.all([
      this.prisma.testAttempt.count({ where }),
      this.prisma.testAttempt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { 
          student: { select: { name: true, avatar: true } },
          test: { select: { name: true } }
        },
      }),
    ]);

    return {
      data: data.map((a) => this.map_attempt_to_dto(a)),
      meta: {
        current_page: page,
        total_pages: Math.ceil(total_items / limit),
        total_items,
      },
    };
  }

  /**
   * Finds a single attempt by ID.
   */
  async find_attempt_one(
    attempt_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attempt_id },
      include: { 
        test: true,
        student: { select: { name: true, avatar: true } }
      },
    });

    if (!attempt) throw new NotFoundException('attempt_not_found');

    return this.map_attempt_to_dto(attempt);
  }

  /**
   * Grades a manually reviewed answer.
   */
  async review_answer(
    attempt_id: string,
    answer_id: string,
    dto: any, // ReviewAnswerDto
    teacher_id: string,
    teacher_role: Role,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.prisma.testAttempt.findUnique({
      where: { id: attempt_id },
      include: { test: true },
    });

    if (!attempt) throw new NotFoundException('attempt_not_found');

    const answers = attempt.answers as any[];
    const answer_index = answers.findIndex(a => a.id === answer_id || a.question_id === answer_id);
    if (answer_index === -1) throw new NotFoundException('answer_not_found');

    // Update the answer in the list
    answers[answer_index] = {
      ...answers[answer_index],
      points_awarded: dto.points_awarded,
      teacher_comment: dto.teacher_comment,
      is_correct: dto.points_awarded > 0, // Simple logic
      reviewed_by: teacher_id,
      reviewed_at: new Date().toISOString(),
    };

    // Re-calculate overall score
    const new_score = answers.reduce((sum, a) => sum + (a.points_awarded || 0), 0);
    const has_more_pending = answers.some(a => a.question_type === 'detailed_answer' && a.reviewed_at === undefined);
    const new_status = has_more_pending ? TestStatus.pending_review : TestStatus.reviewed;

    try {
      const updated = await this.prisma.testAttempt.update({
        where: { id: attempt_id },
        data: {
          answers: answers as any,
          score: new_score,
          status: new_status,
          is_passed: (new_score / (attempt.total_points ?? 1)) * 100 >= (attempt.test.settings as any).passing_score,
        },
        include: {
          test: { select: { id: true, name: true } },
          student: { select: { id: true, name: true, avatar: true } },
        },
      });

      // Notify student if review is finished
      if (attempt.status === TestStatus.pending_review && new_status === TestStatus.reviewed) {
        await this.prisma.notification.create({
          data: {
            user_id: updated.student.id,
            message_id: updated.test.id,
            message_title: updated.test.name,
            message_type: 'test',
            message: 'test_reviewed',
            payload: {
              test_id: updated.test.id,
              test_name: updated.test.name,
              attempt_id: updated.id,
              score: updated.score,
              total_points: updated.total_points,
            },
          },
        });
      }

      return this.map_attempt_to_dto(updated);
    } catch (error) {
      this.handle_error(error, 'review_answer');
    }
  }

  /**
   * Gets total count of pending reviews across all tests based on role and requester.
   */
  async get_pending_review_count(
    requester_id: string,
    requester_role: Role,
  ): Promise<number> {
    if (requester_role === Role.student) return 0;

    const user = await this.prisma.user.findUnique({
      where: { id: requester_id },
      select: { super_admin_id: true },
    });

    if (!user) return 0;

    const super_admin_id = requester_role === Role.super_admin ? requester_id : user.super_admin_id;

    if (requester_role === Role.super_admin || requester_role === Role.admin) {
      return this.prisma.testAttempt.count({
        where: {
          status: TestStatus.pending_review,
          test: {
            super_admin_id: super_admin_id,
          },
        },
      });
    }

    if (requester_role === Role.teacher) {
      return this.prisma.testAttempt.count({
        where: {
          status: TestStatus.pending_review,
          student: {
            teacher_id: requester_id,
          },
        },
      });
    }

    return 0;
  }

  /**
   * Gets stats for a test or global stats for the entire space.
   */
  async get_test_stats(requester_id: string, requester_role: Role, test_id?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: requester_id },
      select: { super_admin_id: true },
    });

    if (!user) throw new NotFoundException('user_not_found');

    const super_admin_id =
      requester_role === Role.super_admin ? requester_id : user.super_admin_id || requester_id;

    const where: Prisma.TestAttemptWhereInput = {
      test: {
        super_admin_id: super_admin_id,
      },
    };

    if (test_id) {
      where.test_id = test_id;
    }

    const attempts = await this.prisma.testAttempt.findMany({
      where,
      select: { 
        score: true, 
        total_points: true, 
        time_spent: true, 
        is_passed: true,
        student_id: true,
        status: true
      }
    });

    if (attempts.length === 0) {
      return {
        total_attempts: 0,
        unique_students: 0,
        average_score: 0,
        pass_rate: 0,
        average_time: 0,
        pending_reviews: 0,
      };
    }

    const total_attempts = attempts.length;
    const unique_students = new Set(attempts.map(a => a.student_id)).size;
    const avg_score = attempts.reduce((sum, a) => sum + ((a.total_points ?? 0) > 0 ? ((a.score ?? 0) / (a.total_points ?? 0)) * 100 : 0), 0) / total_attempts;
    const pass_rate = (attempts.filter(a => a.is_passed).length / total_attempts) * 100;
    const avg_time = attempts.reduce((sum, a) => sum + a.time_spent, 0) / total_attempts;
    const pending_reviews = attempts.filter(a => a.status === TestStatus.pending_review).length;

    return {
      total_attempts,
      unique_students,
      average_score: avg_score,
      pass_rate,
      average_time: avg_time,
      pending_reviews,
    };
  }

  /**
   * Safe mapping from Prisma model to Frontend DTO
   */
  private map_attempt_to_dto(attempt: any): AttemptResponseDto {
    const score = attempt.score ?? 0;
    const total_points = attempt.total_points ?? 0;
    const percentage = total_points > 0 ? (score / total_points) * 100 : 0;

    return {
      ...attempt,
      student_name: attempt.student?.name,
      student_avatar: attempt.student?.avatar,
      test_name: attempt.test?.name,
      max_score: total_points, // UI expects max_score
      percentage: percentage, // Ensure percentage is always calculated
    } as unknown as AttemptResponseDto;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async find_test_or_throw(test_id: string) {
    const test = await this.prisma.test.findUnique({ where: { id: test_id } });
    if (!test) throw new NotFoundException('test_not_found');
    return test;
  }

  private async check_test_ownership(test: any, requester_id: string, requester_role: Role) {
    if (requester_role === Role.super_admin && test.super_admin_id === requester_id) return;
    if (test.author_id === requester_id) return;

    throw new ForbiddenException('unauthorized_test_access');
  }

  private async check_test_access(test: any, requester_id: string, requester_role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: requester_id },
      select: { super_admin_id: true },
    });

    if (!user) throw new NotFoundException('user_not_found');

    const super_admin_id = requester_role === Role.super_admin ? requester_id : user.super_admin_id;
    
    if (test.super_admin_id !== super_admin_id) {
       throw new ForbiddenException('forbidden');
    }

    if (requester_role === Role.student) {
      const access = await this.prisma.materialAccess.findUnique({
        where: {
          student_id_material_type_material_id: {
            student_id: requester_id,
            material_type: 'test',
            material_id: test.id,
          },
        },
      });

      if (!access) {
        throw new ForbiddenException('access_denied_test');
      }
    }
  }

  private calculate_detailed_score(questions: any[], student_answers: any[]) {
    let score = 0;
    let total_points = 0;
    const processed_answers: any[] = [];

    const answer_map = new Map(student_answers.map(a => [a.question_id, a]));

    for (const q of questions) {
      const q_points = q.points || 0;
      total_points += q_points;
      const answer = answer_map.get(q.id);
      
      const processed: any = {
        id: q.id,
        question_id: q.id,
        question_type: q.type,
        is_correct: false,
        points_awarded: 0,
      };

      if (!answer) {
        processed_answers.push(processed);
        continue;
      }

      processed.selected_option_ids = answer.selected_option_ids;
      processed.selected_option_id = answer.selected_option_id; // Support old UI
      processed.text_answer = answer.text_answer || answer.answer_text;

      if (q.type === 'single_choice') {
        const sid = answer.selected_option_id || answer.selected_option_ids?.[0];
        const selected_option = q.options.find(o => o.id === sid);
        if (selected_option?.is_correct) {
          processed.is_correct = true;
          processed.points_awarded = q_points;
          score += q_points;
        }
      } else if (q.type === 'multiple_choice') {
        const correct_ids = q.options.filter(o => o.is_correct).map(o => o.id);
        const student_selected_ids = answer.selected_option_ids || (answer.selected_option_id ? [answer.selected_option_id] : []);
        
        const is_fully_correct = 
          correct_ids.length === student_selected_ids.length &&
          correct_ids.every(id => student_selected_ids.includes(id));
        
        if (is_fully_correct) {
          processed.is_correct = true;
          processed.points_awarded = q_points;
          score += q_points;
        }
      } else if (q.type === 'fill_in_blank') {
        const txt = answer.text_answer || answer.answer_text;
        if (q.correct_answer_text?.toLowerCase().trim() === txt?.toLowerCase().trim()) {
          processed.is_correct = true;
          processed.points_awarded = q_points;
          score += q_points;
        }
      } else if (q.type === 'detailed_answer') {
        processed.is_correct = null; // Awaiting review
        processed.points_awarded = 0;
      }

      processed_answers.push(processed);
    }

    return { 
        score, 
        total_points, 
        processed_answers,
        percentage: total_points > 0 ? (score / total_points) * 100 : 0
    };
  }


  private async addTestToCourses(testId: string, courseIds: string[]) {
    for (const courseId of courseIds) {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { content: true }
      });

      if (!course) continue;

      const content = Array.isArray(course.content) ? [...course.content] : [];
      
      const exists = content.some((item: any) => item.type === 'test' && item.test_id === testId);
      if (exists) continue;

      content.push({
        type: 'test',
        id: crypto.randomUUID(),
        test_id: testId
      });

      await this.prisma.course.update({
        where: { id: courseId },
        data: { content }
      });
    }
  }

  private handle_error(error: unknown, context: string): never {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    this.logger.error(`TestsService.${context} error`, error instanceof Error ? error.stack : String(error));
    throw new InternalServerErrorException('internal_server_error');
  }
}
