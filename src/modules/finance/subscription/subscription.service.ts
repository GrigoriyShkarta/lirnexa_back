import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { Role } from '@prisma/client';
import { CreateStudentSubscriptionDto } from './dto/create-student-subscription.dto';
import { UpdateStudentSubscriptionDto } from './dto/update-student-subscription.dto';
import { UpdateLessonStatusDto } from './dto/update-lesson-status.dto';

import { TransactionQueryDto } from './dto/transaction-query.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { GoogleCalendarService } from '../../integrations/google-calendar/google-calendar.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Daily cleanup of expired Stream recording links (14 days retention).
   * Runs every day at 3 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredRecordings() {
    this.logger.log('Starting cleanup of expired Stream recording links...');
    
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    try {
      const result = await this.prisma.subscriptionLesson.updateMany({
        where: {
          date: { lt: twoWeeksAgo },
          recording_url: {
            contains: 'stream-io-cdn.com', // Only target Stream temporary links
          },
        },
        data: {
          recording_url: null,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Successfully removed ${result.count} expired Stream recording links.`);
      } else {
        this.logger.log('No expired Stream recording links found.');
      }
    } catch (error) {
      this.logger.error('Failed to cleanup expired recordings:', error);
    }
  }

  async create(userId: string, userRole: Role, dto: CreateSubscriptionDto) {
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

    return this.prisma.subscription.create({
      data: {
        ...dto,
        author_id: userId,
        super_admin_id,
      },
    });
  }

  async get_all(userId: string, query: SubscriptionQueryDto) {
    const { search, page = 1, limit = 10 } = query;
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

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
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
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
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
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID ${id} not found`);
    }

    return subscription;
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    return this.prisma.subscription.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    return this.prisma.subscription.delete({
      where: { id },
    });
  }

  async remove_bulk(ids: string[]) {
    return this.prisma.subscription.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  // --- Student Subscription Logic ---

  async assignToStudent(dto: CreateStudentSubscriptionDto) {
    let name = dto.name;
    let price = dto.price;
    let lessonsCount = dto.lessons_count;

    if (dto.subscription_id) {
      const template = await this.prisma.subscription.findUnique({
        where: { id: dto.subscription_id },
      });

      if (!template) {
        throw new NotFoundException('Subscription template not found');
      }

      // If not explicitly provided in DTO, use values from template
      name = name ?? template.name;
      price = price ?? template.price;
      lessonsCount = lessonsCount ?? template.lessons_count;
    }

    if (!name || price === undefined || lessonsCount === undefined) {
      throw new BadRequestException(
        'Subscription name, price and lessons count are required for custom subscriptions',
      );
    }

    // Fetch student's super_admin_id
    const student = await this.prisma.user.findUnique({
      where: { id: dto.student_id },
      select: { 
        super_admin_id: true,
      },
    });

    const studentSuperAdminId = student?.super_admin_id || null;

    // Use default payment date if not provided
    const paymentDate = dto.payment_date ? new Date(dto.payment_date) : new Date();

    const studentSubscription = await this.prisma.studentSubscription.create({
      data: {
        name,
        price,
        lessons_count: lessonsCount,
        paid_amount: dto.paid_amount ?? 0,
        payment_status: dto.payment_status ?? 'unpaid',
        payment_date: paymentDate,
        partial_payment_date: dto.partial_payment_date ? new Date(dto.partial_payment_date) : null,
        next_payment_date: dto.next_payment_date ? new Date(dto.next_payment_date) : null,
        payment_reminder: dto.payment_reminder ?? false,
        selected_days: dto.selected_days ?? [],
        comment: dto.comment,
        student_id: dto.student_id,
        subscription_id: dto.subscription_id,
        super_admin_id: studentSuperAdminId,
        lessons: {
          create: Array.from({ length: lessonsCount }).map((_, i) => ({
            date: dto.lesson_dates?.[i] ? new Date(dto.lesson_dates[i]) : null,
            status: 'scheduled',
          })),
        },
        transactions: (dto.paid_amount && dto.paid_amount > 0) ? {
          create: {
            amount: dto.paid_amount,
            payment_date: paymentDate,
            super_admin_id: studentSuperAdminId,
            student_id: dto.student_id,
            comment: 'Initial payment',
          }
        } : undefined,
      },
      include: {
        lessons: true,
        subscription: true,
      },
    });

    // Sync initial lessons to Google Calendar
    for (const lesson of studentSubscription.lessons) {
      if (lesson.date) {
        await this.syncLessonToGoogleCalendar(lesson.id, [dto.student_id, studentSuperAdminId]);
      }
    }

    return studentSubscription;
  }

  async getStudentSubscriptions(studentId: string, userRole: Role) {
    const now = new Date();

    // Automatically mark past lessons as 'attended' unless they are 'burned' or already 'attended'
    const result = await this.prisma.subscriptionLesson.updateMany({
      where: {
        subscription: { student_id: studentId },
        date: { lt: now, not: null }, // Only target lessons with a concrete past date
        status: 'scheduled',
      },
      data: { status: 'attended' },
    });

    if (result.count > 0) {
      this.logger.log(`Automatically marked ${result.count} past lessons as 'attended' for student ${studentId}`);
    }

    const subscriptions = await this.prisma.studentSubscription.findMany({
      where: { student_id: studentId },
      include: {
        lessons: {
          orderBy: { date: 'asc' },
        },
        student: {
          select: {
            can_student_download_recording: true,
          },
        },
        subscription: {
          select: {
            id: true,
            name: true,
            lessons_count: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Final in-memory sort to ensure they are ordered by lesson dates
    subscriptions.sort((a: any, b: any) => {
      const aFirstLesson = a.lessons.find((l: any) => l.date);
      const bFirstLesson = b.lessons.find((l: any) => l.date);

      if (!aFirstLesson && !bFirstLesson) return 0;
      if (!aFirstLesson) return 1;
      if (!bFirstLesson) return -1;

      return (aFirstLesson.date?.getTime() || 0) - (bFirstLesson.date?.getTime() || 0);
    });
    
    return subscriptions;
  }

  async updateStudentSubscription(id: string, dto: UpdateStudentSubscriptionDto) {
    const current = await this.prisma.studentSubscription.findUnique({
      where: { id },
      select: { price: true, paid_amount: true, student_id: true, super_admin_id: true },
    });

    if (!current) {
      throw new NotFoundException(`Student subscription with ID ${id} not found`);
    }

    const data: any = { ...dto };

    // Auto-calculate or explicitly handle payment status
    if (dto.paid_amount !== undefined) {
      const paidAmount = dto.paid_amount;
      const price = current.price;

      if (paidAmount >= price) {
        data.payment_status = 'paid';
      } else if (paidAmount > 0) {
        data.payment_status = 'partially_paid';
      } else {
        data.payment_status = 'unpaid';
      }
    }

    // Ensure partial_payment_date and paid_amount are handled correctly based on status
    const finalStatus = data.payment_status ?? dto.payment_status;
    if (finalStatus === 'paid') {
      data.partial_payment_date = null;
      data.paid_amount = current.price;
      if (!dto.payment_date) {
        data.payment_date = new Date();
      }
    } else if (finalStatus === 'unpaid') {
      data.partial_payment_date = null;
      data.paid_amount = 0;
      data.payment_date = null;
    } else if (finalStatus === 'partially_paid') {
      if (dto.partial_payment_date) {
        data.partial_payment_date = new Date(dto.partial_payment_date);
      }
    }

    if (dto.payment_date) {
      data.payment_date = new Date(dto.payment_date);
    }
    if (dto.next_payment_date) {
      data.next_payment_date = new Date(dto.next_payment_date);
    }

    const updated = await this.prisma.studentSubscription.update({
      where: { id },
      data,
    });

    // Record transaction for payment increase
    const newPaidAmount = data.paid_amount ?? current.paid_amount;
    if (newPaidAmount > current.paid_amount) {
      const diff = newPaidAmount - current.paid_amount;
      await this.prisma.paymentTransaction.create({
        data: {
          amount: diff,
          payment_date: dto.payment_date ? new Date(dto.payment_date) : new Date(),
          student_subscription_id: id,
          super_admin_id: current.super_admin_id,
          student_id: current.student_id,
          comment: dto.comment || 'Additional payment',
        }
      });
    }

    return updated;
  }

  async getLessonById(lessonId: string, userId: string, userRole: Role) {
    const lesson = await this.prisma.subscriptionLesson.findUnique({
      where: { id: lessonId },
      include: {
        subscription: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                avatar: true,
                can_student_download_recording: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    return lesson;
  }

  async updateLessonStatus(lessonId: string, dto: UpdateLessonStatusDto) {
    this.logger.log(`Updating lesson status for lesson ${lessonId}. New status: ${dto.status}, Date provided: ${dto.date}`);
    
    const current = await this.prisma.subscriptionLesson.findUnique({
      where: { id: lessonId },
    });

    if (!current) {
      this.logger.warn(`Lesson with ID ${lessonId} not found during status update`);
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    const data: any = { ...dto };
    const status = dto.status || current.status;

    // For 'attended' and 'burned' statuses - do not touch the date unless provided
    if (status === 'attended' || status === 'burned') {
      if (dto.date !== undefined) {
        data.date = dto.date ? new Date(dto.date) : null;
      } else {
        delete data.date;
      }
    } else {
      // For 'scheduled' or 'rescheduled'
      let dateToUse = dto.date !== undefined ? (dto.date ? new Date(dto.date) : null) : current.date;

      // If the resulting date is in the past and we are in scheduled/rescheduled status, 
      // clear it to null to prevent the auto-marker from flipping it back to 'attended'.
      if (dateToUse && dateToUse < new Date()) {
        this.logger.log(`Clearing past date for lesson ${lessonId} in ${status} status to prevent auto-attended mark`);
        data.date = null;
      } else if (dto.date !== undefined) {
        data.date = dateToUse;
      }
    }

    const updated = await this.prisma.subscriptionLesson.update({
      where: { id: lessonId },
      data,
      include: {
        subscription: {
          select: { student_id: true, super_admin_id: true },
        },
      },
    });

    this.logger.log(`Successfully updated lesson ${lessonId} to status ${updated.status}. Syncing to Google Calendar...`);

    // Sync to Google Calendar
    try {
      await this.syncLessonToGoogleCalendar(
        lessonId,
        [updated.subscription.student_id, updated.subscription.super_admin_id]
      );
    } catch (error) {
       this.logger.error(`Failed to sync lesson ${lessonId} to Google Calendar:`, error);
    }

    return updated;
  }

  async updateLessonRecording(lessonId: string, recording_url: string) {
    this.logger.log(`Updating recording URL for lesson ${lessonId}: ${recording_url}`);
    
    const current = await this.prisma.subscriptionLesson.findUnique({
      where: { id: lessonId },
    });

    if (!current) {
      this.logger.warn(`Lesson with ID ${lessonId} not found during recording update`);
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    if (current.recording_url && current.recording_url !== recording_url) {
      this.logger.log(`Deleting old recording: ${current.recording_url}`);
      await this.storageService.deleteFile(current.recording_url);
    }

    return this.prisma.subscriptionLesson.update({
      where: { id: lessonId },
      data: { recording_url },
    });
  }

  async deleteLessonRecording(lessonId: string) {
    const current = await this.prisma.subscriptionLesson.findUnique({
      where: { id: lessonId },
    });

    if (!current) {
      throw new NotFoundException(`Lesson with ID ${lessonId} not found`);
    }

    if (current.recording_url) {
      await this.storageService.deleteFile(current.recording_url);
    }

    return this.prisma.subscriptionLesson.update({
      where: { id: lessonId },
      data: { recording_url: null },
    });
  }

  async removeStudentSubscription(id: string) {
    return this.prisma.studentSubscription.delete({
      where: { id },
    });
  }

  async removeStudentSubscriptionsBulk(ids: string[]) {
    return this.prisma.studentSubscription.deleteMany({
      where: {
        id: { in: ids },
      },
    });
  }

  async getAllStudentSubscriptions(userId: string, userRole: Role) {
    let super_admin_id = userId;

    if (userRole !== Role.super_admin) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { super_admin_id: true },
      });
      super_admin_id = user?.super_admin_id || userId;
    }

    return this.prisma.studentSubscription.findMany({
      where: {
        super_admin_id,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
        subscription: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAllTransactions(userId: string, userRole: Role, query: TransactionQueryDto) {
    let super_admin_id = userId;

    if (userRole !== Role.super_admin) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { super_admin_id: true },
      });
      super_admin_id = user?.super_admin_id || userId;
    }

    const { start_date, end_date } = query;
    const where: any = { super_admin_id };

    if (start_date || end_date) {
      where.payment_date = {};
      if (start_date) where.payment_date.gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        where.payment_date.lte = endDate;
      }
    }

    return this.prisma.paymentTransaction.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        subscription: {
          select: { id: true, name: true },
        },
      },
      orderBy: { payment_date: 'desc' },
    });
  }

  async getSubscriptionTransactions(subscriptionId: string) {
    return this.prisma.paymentTransaction.findMany({
      where: { student_subscription_id: subscriptionId },
      orderBy: { payment_date: 'desc' },
    });
  }

  async getCalendar(userId: string, userRole: Role, query: CalendarQueryDto) {
    const { start_date, end_date, student_id } = query;
    const where: any = {};

    if (userRole === Role.student) {
      // Student sees only their own lessons
      where.subscription = { student_id: userId };
    } else {
      // Admin/Teacher see lessons of their students
      let super_admin_id = userId;
      if (userRole !== Role.super_admin) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { super_admin_id: true },
        });
        super_admin_id = user?.super_admin_id || userId;
      }

      where.subscription = { super_admin_id };

      // Optional filter by student
      if (student_id) {
        where.subscription.student_id = student_id;
      }
    }

    // Date range filter for lessons
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        where.date.lte = endDate;
      }
    } else {
      where.date = { not: null };
    }

    const lessons = await this.prisma.subscriptionLesson.findMany({
      where,
      include: {
        subscription: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                avatar: true,
                can_student_download_recording: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Fetch personal events for the requester
    const personalWhere: any = { user_id: userId };
    if (start_date || end_date) {
      personalWhere.start_time = {};
      if (start_date) personalWhere.start_time.gte = new Date(start_date);
      if (end_date) {
        const endDate = new Date(end_date);
        endDate.setHours(23, 59, 59, 999);
        personalWhere.start_time.lte = endDate;
      }
    }

    const personalEvents = await this.prisma.personalEvent.findMany({
      where: personalWhere,
      orderBy: { start_time: 'asc' },
    });

    // Map both to a unified format
    const formattedLessons = lessons.map(l => ({
      ...l,
      source: 'lesson'
    }));

    const formattedPersonal = personalEvents.map(e => ({
      id: e.id,
      date: e.start_time,
      end_time: e.end_time,
      status: 'personal',
      source: 'personal',
      subscription: {
        name: e.summary,
        description: e.description,
        personal_data: e,
      }
    }));

    return [...formattedLessons, ...formattedPersonal].sort((a, b) => 
      (a.date?.getTime() || 0) - (b.date?.getTime() || 0)
    );
  }

  // --- Helper to sync Google Calendar ---
  private async syncLessonToGoogleCalendar(lessonId: string, userIds: (string | null)[]) {
    const lesson = await this.prisma.subscriptionLesson.findUnique({
      where: { id: lessonId },
      include: {
        subscription: {
          include: { student: true, subscription: true },
        },
      },
    });

    if (!lesson) return;

    const summary = `${lesson.subscription.subscription?.name || lesson.subscription.name || 'Lesson'} - ${lesson.subscription.student.name}`;

    for (const userId of userIds) {
      if (!userId) continue;

      const isConnected = await this.googleCalendarService.isConnected(userId);
      if (!isConnected) continue;

      // Unschedule / cancel
      if (lesson.status === 'rescheduled' || lesson.status === 'burned' || !lesson.date) {
        if (lesson.google_event_id) {
          await this.googleCalendarService.deleteEvent(userId, lesson.google_event_id);
        }
        continue;
      }

      // Create or Update
      const safeStartTime = lesson.date as Date;
      const safeEndTime = new Date(safeStartTime.getTime() + 60 * 60 * 1000);

      const attendees = lesson.subscription.student.email ? [{ email: lesson.subscription.student.email }] : [];

      if (lesson.google_event_id) {
         await this.googleCalendarService.updateEvent(userId, lesson.google_event_id, {
           summary,
           startTime: safeStartTime,
           endTime: safeEndTime,
           attendees,
         });
      } else {
         const eventId = await this.googleCalendarService.createEvent(userId, {
           summary,
           startTime: safeStartTime,
           endTime: safeEndTime,
           lessonId,
           attendees,
         });
         
         if (eventId) {
           await this.prisma.subscriptionLesson.update({
             where: { id: lessonId },
             data: { google_event_id: eventId },
           });
           break; 
         }
      }
    }
  }
}
