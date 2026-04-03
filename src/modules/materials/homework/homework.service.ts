import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Role, HomeworkStatus, MaterialType, Prisma } from '@prisma/client';
import { CreateHomeworkDto, UpdateHomeworkDto, SubmitHomeworkDto, ReviewHomeworkDto, HomeworkQueryDto } from './dto/homework.dto';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import { StorageService } from 'src/modules/storage/storage.service';


@Injectable()
export class HomeworkService {
  private readonly logger = new Logger(HomeworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Homework Management (Admin/Teacher)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new homework for a lesson.
   * @param dto Create homework DTO.
   * @param author_id The user ID of the creator.
   * @param author_role The role of the creator.
   * @returns The created homework.
   */
  async create(dto: CreateHomeworkDto, author_id: string, author_role: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id: author_id },
      select: { super_admin_id: true },
    });

    if (!user) throw new NotFoundException('user_not_found');

    const super_admin_id = author_role === Role.super_admin ? author_id : user.super_admin_id;

    if (dto.lesson_id) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lesson_id },
      });

      if (!lesson) throw new NotFoundException('lesson_not_found');

      const existing = await this.prisma.homework.findUnique({
        where: { lesson_id: dto.lesson_id },
      });
      if (existing) throw new BadRequestException('homework_already_exists_for_this_lesson');
    }

    return this.prisma.homework.create({
      data: {
        name: dto.name,
        content: dto.content as any || [],
        lesson_id: dto.lesson_id,
        author_id,
        super_admin_id,
        ...(dto.category_ids && {
          categories: { connect: dto.category_ids.map(id => ({ id })) },
        }),
      },
      include: { categories: true },
    });
  }

  /**
   * Updates an existing homework.
   * @param id Homework ID.
   * @param dto Update homework DTO.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns The updated homework.
   */
  async update(id: string, dto: UpdateHomeworkDto, requester_id: string, requester_role: Role) {
    const homework = await this.prisma.homework.findUnique({ where: { id } });
    if (!homework) throw new NotFoundException('homework_not_found');

    await this.check_homework_ownership(homework, requester_id, requester_role);

    if (dto.lesson_id && dto.lesson_id !== homework.lesson_id) {
      const existing = await this.prisma.homework.findUnique({
        where: { lesson_id: dto.lesson_id },
      });
      if (existing) throw new BadRequestException('homework_already_exists_for_this_lesson');
    }

    return this.prisma.homework.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content as any }),
        ...(dto.lesson_id !== undefined && { lesson_id: dto.lesson_id }),
        ...(dto.category_ids !== undefined && {
          categories: { set: dto.category_ids.map(id => ({ id })) },
        }),
      },
      include: { categories: true },
    });
  }

  /**
   * Deletes a homework.
   * @param id Homework ID.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns Deleted homework.
   */
  async delete(id: string, requester_id: string, requester_role: Role) {
    const homework = await this.prisma.homework.findUnique({ where: { id } });
    if (!homework) throw new NotFoundException('homework_not_found');

    await this.check_homework_ownership(homework, requester_id, requester_role);

    return this.prisma.homework.delete({ where: { id } });
  }

  /**
   * Returns all available homeworks with pagination and search.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @param query Search and pagination parameters.
   * @returns Paginated list of homeworks.
   */
  async get_all(requester_id: string, requester_role: Role, query: HomeworkQueryDto) {
    const { page = 1, limit = 10, search, category_ids, lesson_id, from_student, student_id, statuses, status } = query;
    const skip = (page - 1) * limit;

    const user = await this.prisma.user.findUnique({ where: { id: requester_id }, select: { super_admin_id: true } });
    const super_admin_id = requester_role === Role.super_admin ? requester_id : user?.super_admin_id;

    const effectiveStatuses = statuses || (status ? [status] : undefined);

    const where: Prisma.HomeworkWhereInput = {
      ...(requester_role !== Role.super_admin && requester_role !== Role.admin && { super_admin_id }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          {
            submissions: {
              some: {
                student: { name: { contains: search, mode: 'insensitive' } },
                ...( (requester_role === Role.student || from_student) && { student_id: student_id || requester_id } )
              }
            }
          }
        ]
      }),
      ...(category_ids && category_ids.length > 0 && {
        categories: { some: { id: { in: category_ids } } },
      }),
      ...(lesson_id && { lesson_id }),
      ...(from_student && {
        lesson: {
          access: {
            some: {
              student_id: student_id || requester_id,
            },
          },
        },
      }),
      ...(effectiveStatuses && effectiveStatuses.length > 0 && {
        submissions: {
          some: {
            status: { in: effectiveStatuses as HomeworkStatus[] },
            ...( (requester_role === Role.student || from_student) && { student_id: student_id || requester_id } )
          }
        }
      }),
    };

    const [total, items] = await Promise.all([
      this.prisma.homework.count({ where }),
      this.prisma.homework.findMany({
        where,
        skip,
        take: limit,
        include: {
          categories: true,
          lesson: { select: { id: true, name: true } },
          _count: { select: { submissions: true } },
          submissions: (requester_role === Role.student || from_student) ? {
            where: {
              student_id: student_id || requester_id,
              ...(effectiveStatuses && effectiveStatuses.length > 0 && { status: { in: effectiveStatuses as HomeworkStatus[] } }),
              ...(search && {
                homework: { name: { contains: search, mode: 'insensitive' } } // For students, search by homework name
              })
            },
            orderBy: { created_at: 'desc' },
            take: 1,
            include: { student: { select: { id: true, name: true, avatar: true } } },
          } : {
            where: {
              ...(effectiveStatuses && effectiveStatuses.length > 0 && { status: { in: effectiveStatuses as HomeworkStatus[] } }),
              ...(search && {
                OR: [
                  { student: { name: { contains: search, mode: 'insensitive' } } },
                  { homework: { name: { contains: search, mode: 'insensitive' } } }
                ]
              })
            },
            orderBy: { created_at: 'desc' },
            include: { student: { select: { id: true, name: true, avatar: true } } },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    const data = items.map(item => {
      let submission_status = 'not_submitted';
      // any used because of Prisma include type inference
      if ((item as any).submissions?.length > 0) {
        submission_status = (item as any).submissions[0].status;
      }
      return {
        ...item,
        submission_status: (requester_role === Role.student || from_student) ? submission_status : undefined,
      };
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Finds a homework by lesson ID, checking access for students.
   * @param lesson_id The lesson ID.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns Homework object.
   */
  async find_by_lesson(lesson_id: string, requester_id: string, requester_role: Role) {
    const homework = await this.prisma.homework.findUnique({
      where: { lesson_id },
      include: { lesson: true, categories: true },
    });

    if (!homework) throw new NotFoundException('homework_not_found');

    if (requester_role === Role.student) {
      const access = await this.prisma.materialAccess.findUnique({
        where: {
          student_id_material_type_material_id: {
            student_id: requester_id,
            material_type: MaterialType.lesson,
            material_id: lesson_id,
          },
        },
      });
      if (!access) throw new ForbiddenException('access_denied_lesson');
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: requester_id }, select: { super_admin_id: true } });
      const super_admin_id = requester_role === Role.super_admin ? requester_id : user?.super_admin_id;
      if (homework.super_admin_id !== super_admin_id) throw new ForbiddenException('forbidden');
    }

    return homework;
  }

  /**
   * Finds a single homework by its ID, checking access for students.
   * @param id Homework ID.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns Homework object.
   */
  async find_by_id(id: string, requester_id: string, requester_role: Role) {
    const homework = await this.prisma.homework.findUnique({
      where: { id },
      include: {
        lesson: true,
        categories: true,
        submissions: (requester_role === Role.student) ? {
          where: { student_id: requester_id },
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { student: { select: { id: true, name: true, avatar: true } } },
        } : {
          include: { student: { select: { id: true, name: true, avatar: true } } },
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!homework) throw new NotFoundException('homework_not_found');

    if (requester_role === Role.student) {
      if (!homework.lesson_id) throw new ForbiddenException('homework_has_no_associated_lesson');

      const access = await this.prisma.materialAccess.findUnique({
        where: {
          student_id_material_type_material_id: {
            student_id: requester_id,
            material_type: MaterialType.lesson,
            material_id: homework.lesson_id,
          },
        },
      });
      if (!access) throw new ForbiddenException('access_denied_lesson');
    } else {
      const user = await this.prisma.user.findUnique({ where: { id: requester_id }, select: { super_admin_id: true } });
      const super_admin_id = requester_role === Role.super_admin ? requester_id : user?.super_admin_id;
      if (homework.super_admin_id !== super_admin_id) throw new ForbiddenException('forbidden');
    }

    return homework;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submissions (Student)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Submits a homework as a student.
   * @param homework_id Homework ID.
   * @param dto Submission data.
   * @param student_id Student user ID.
   * @param files Optional uploaded files.
   * @returns The created submission.
   */
  async submit(homework_id: string, dto: SubmitHomeworkDto, student_id: string, files: Express.Multer.File[]) {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homework_id },
      include: { 
        lesson: { select: { id: true, name: true } },
        super_admin: { select: { id: true, name: true } }
      },
    });

    if (!homework) throw new NotFoundException('homework_not_found');

    if (!homework.lesson_id) throw new ForbiddenException('homework_has_no_associated_lesson');

    const access = await this.prisma.materialAccess.findUnique({
      where: {
        student_id_material_type_material_id: {
          student_id: student_id,
          material_type: MaterialType.lesson,
          material_id: homework.lesson_id,
        },
      },
    });
    if (!access) throw new ForbiddenException('access_denied_lesson');

    const studentWithRelations = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, name: true, super_admin_id: true, teacher_id: true }
    });

    if (!studentWithRelations) throw new NotFoundException('student_not_found');

    const uploaded_file_urls: string[] = [];

    if (files && files.length > 0) {
      const saPart = `${homework.super_admin?.name || 'admin'}-${homework.super_admin_id}`;
      const studentPart = `${studentWithRelations.name}-${studentWithRelations.id}`;
      const lessonPart = homework.lesson ? `${homework.lesson.name}-${homework.lesson.id}` : 'unattached';
      const storagePath = `${saPart}/homeworks/${studentPart}/${lessonPart}`;

      for (const file of files) {
        const url = await this.storage.uploadFile(file, storagePath);
        uploaded_file_urls.push(url);
      }
    }

    const final_file_urls = [...(dto.file_urls || []), ...uploaded_file_urls];

    const submission = await this.prisma.homeworkSubmission.create({
      data: {
        homework_id,
        student_id,
        text: dto.text || '',
        file_urls: final_file_urls,
        status: HomeworkStatus.pending,
      },
    });

    const recipients = new Set<string>();
    if (studentWithRelations.super_admin_id) recipients.add(studentWithRelations.super_admin_id);
    if (studentWithRelations.teacher_id) recipients.add(studentWithRelations.teacher_id);
    if (homework.author_id) recipients.add(homework.author_id);

    for (const recipient_id of recipients) {
      if (recipient_id === student_id) continue;

      await this.prisma.notification.create({
        data: {
          user_id: recipient_id,
          message_id: student_id,
          message_title: studentWithRelations.name,
          message_type: 'homework',
          message: 'homework_completed',
          payload: {
            lesson_id: homework.lesson?.id || null,
            homework_id: homework.id,
            lesson_name: homework.lesson?.name || '',
            homework_name: homework.name,
            student_id: student_id,
            student_name: studentWithRelations.name,
            submission_id: submission.id,
          },
        },
      }).catch(err => this.logger.error(`Failed to create homework notification: ${err.message}`));
    }

    return submission;
  }

  /**
   * Returns the student's latest submission for a given homework.
   * @param homework_id Homework ID.
   * @param student_id Student user ID.
   * @returns Latest submission record.
   */
  async get_my_submission(homework_id: string, student_id: string) {
    const submission = await this.prisma.homeworkSubmission.findFirst({
      where: { homework_id, student_id },
      orderBy: { created_at: 'desc' },
    });
    return submission;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Review (Teacher/Admin)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all submissions for a project (Admin/Teacher only).
   * @param homework_id Homework ID.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns List of submissions.
   */
  async get_submissions(homework_id: string, requester_id: string, requester_role: Role) {
    const homework = await this.prisma.homework.findUnique({ where: { id: homework_id } });
    if (!homework) throw new NotFoundException('homework_not_found');

    await this.check_homework_ownership(homework, requester_id, requester_role);

    return this.prisma.homeworkSubmission.findMany({
      where: { homework_id },
      include: { student: { select: { id: true, name: true, avatar: true } } },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Reviews and grades a homework submission.
   * @param submission_id Submission ID.
   * @param dto Feedback and status update.
   * @param teacher_id User ID of the reviewer.
   * @param teacher_role Role of the reviewer.
   * @returns Updated submission record.
   */
  async review_submission(submission_id: string, dto: ReviewHomeworkDto, teacher_id: string, teacher_role: Role) {
    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submission_id },
      include: { homework: true },
    });

    if (!submission) throw new NotFoundException('submission_not_found');

    await this.check_homework_ownership(submission.homework, teacher_id, teacher_role);

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submission_id },
      data: {
        feedback: dto.feedback,
        status: dto.status,
        reviewed_by_id: teacher_id,
      },
      include: { homework: true },
    });

    await this.prisma.notification.create({
      data: {
        user_id: updated.student_id,
        message_id: updated.homework.lesson_id || updated.homework.id,
        message_title: updated.homework.name,
        message_type: 'homework_reviewed',
        message: 'homework_reviewed',
        payload: {
          lesson_id: updated.homework.lesson_id,
          homework_id: updated.homework.id,
          homework_name: updated.homework.name,
          submission_id: updated.id,
          status: updated.status,
          feedback: updated.feedback,
        },
      },
    }).catch(err => this.logger.error(`Failed to create homework review notification: ${err.message}`));

    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Checks if the user owns the homework or is a super admin for that space.
   * @param homework Homework object.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @private
   */
  private async check_homework_ownership(homework: any, requester_id: string, requester_role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: requester_id }, select: { super_admin_id: true } });
    const super_admin_id = requester_role === Role.super_admin ? requester_id : user?.super_admin_id;

    if (homework.super_admin_id !== super_admin_id && homework.author_id !== requester_id) {
      throw new ForbiddenException('unauthorized_homework_access');
    }
  }

  /**
   * Returns a single homework submission by its ID.
   * @param id Submission ID.
   * @param requester_id The user ID of the requester.
   * @param requester_role The role of the requester.
   * @returns Submission object.
   */
  async get_submission_by_id(id: string, requester_id: string, requester_role: Role) {
    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { id },
      include: {
        homework: { include: { lesson: { select: { id: true, name: true } } } },
        student: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!submission) throw new NotFoundException('submission_not_found');

    if (requester_role === Role.student && submission.student_id !== requester_id) {
      throw new ForbiddenException('unauthorized_submission_access');
    }

    if (requester_role !== Role.student) {
      await this.check_homework_ownership(submission.homework, requester_id, requester_role);
    }

    return submission;
  }

  /**
   * Gets total count of pending homework reviews across all homeworks based on role and requester.
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
      return this.prisma.homeworkSubmission.count({
        where: {
          status: 'pending',
          homework: {
            super_admin_id: super_admin_id,
          },
        },
      });
    }

    if (requester_role === Role.teacher) {
      return this.prisma.homeworkSubmission.count({
        where: {
          status: 'pending',
          student: {
            teacher_id: requester_id,
          },
        },
      });
    }

    return 0;
  }
}
