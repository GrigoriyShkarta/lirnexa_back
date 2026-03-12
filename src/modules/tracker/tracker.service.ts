import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { 
  CreateColumnDto, 
  CreateTaskDto, 
  UpdateColumnDto, 
  UpdateTaskDto, 
  CreateSubtaskDto, 
} from './dto/tracker.dto';

@Injectable()
export class TrackerService {
  constructor(private prisma: PrismaService) {}

  async get_board(student_id: string, requester_id: string, requester_role: Role) {
    await this.check_board_access(student_id, requester_id, requester_role);

    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { super_admin_id: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    let board = await this.prisma.trackerBoard.findFirst({
      where: { student_id },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                subtasks: { orderBy: { created_at: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!board) {
      // Create a default board for the student if it doesn't exist
      board = await this.prisma.trackerBoard.create({
        data: {
          name: 'My Board',
          student_id,
          super_admin_id: student.super_admin_id,
          columns: {
            create: [
              { title: 'Заплановано', order: 0 },
              { title: 'В процесі', order: 1 },
              { title: 'Виконано', order: 2 },
            ],
          },
        },
        include: {
          columns: {
            orderBy: { order: 'asc' },
            include: {
              tasks: {
                orderBy: { order: 'asc' },
                include: {
                  subtasks: { orderBy: { created_at: 'asc' } },
                },
              },
            },
          },
        },
      });
    }

    return board;
  }

  async create_column(student_id: string, requester_id: string, requester_role: Role, dto: CreateColumnDto) {
    await this.check_create_permission(student_id, requester_id, requester_role);

    const board = await this.prisma.trackerBoard.findFirst({ where: { student_id } });
    if (!board) throw new NotFoundException('Board not found');

    return this.prisma.$transaction(async (tx) => {
      // Shift columns down to make room for the new one
      await tx.trackerColumn.updateMany({
        where: { board_id: board.id, order: { gte: dto.order } },
        data: { order: { increment: 1 } },
      });

      return tx.trackerColumn.create({
        data: {
          title: dto.title,
          color: dto.color,
          order: dto.order,
          board_id: board.id,
        },
      });
    });
  }

  async update_column(column_id: string, requester_id: string, requester_role: Role, dto: UpdateColumnDto) {
    const column = await this.prisma.trackerColumn.findUnique({
      where: { id: column_id },
      include: { board: true },
    });
    if (!column) throw new NotFoundException('Column not found');

    if (dto.title !== undefined || dto.color !== undefined) {
      await this.check_edit_permission(column.board.student_id, requester_id, requester_role);
    } else {
      await this.check_board_access(column.board.student_id, requester_id, requester_role);
    }

    const old_order = column.order;
    const new_order = dto.order !== undefined ? dto.order : old_order;

    if (old_order === new_order && !dto.title) {
      return column;
    }

    return this.prisma.$transaction(async (tx) => {
      if (old_order !== new_order) {
        if (new_order < old_order) {
          // Moving up: shift columns between new and old down
          await tx.trackerColumn.updateMany({
            where: {
              board_id: column.board_id,
              order: { gte: new_order, lt: old_order },
            },
            data: { order: { increment: 1 } },
          });
        } else {
          // Moving down: shift columns between old and new up
          await tx.trackerColumn.updateMany({
            where: {
              board_id: column.board_id,
              order: { gt: old_order, lte: new_order },
            },
            data: { order: { decrement: 1 } },
          });
        }
      }

      return tx.trackerColumn.update({
        where: { id: column_id },
        data: {
          title: dto.title,
          color: dto.color,
          order: new_order,
        },
      });
    });
  }

  async delete_column(column_id: string, requester_id: string, requester_role: Role) {
    const column = await this.prisma.trackerColumn.findUnique({
      where: { id: column_id },
      include: { board: true },
    });
    if (!column) throw new NotFoundException('Column not found');

    await this.check_edit_permission(column.board.student_id, requester_id, requester_role);

    return this.prisma.$transaction(async (tx) => {
      await tx.trackerColumn.delete({ where: { id: column_id } });

      await tx.trackerColumn.updateMany({
        where: { board_id: column.board_id, order: { gt: column.order } },
        data: { order: { decrement: 1 } },
      });

      return { message: 'Column deleted successfully' };
    });
  }

  async create_task(student_id: string, requester_id: string, requester_role: Role, dto: CreateTaskDto) {
    await this.check_create_permission(student_id, requester_id, requester_role);

    return this.prisma.$transaction(async (tx) => {
      // Shift tasks down to make room for the new one
      await tx.trackerTask.updateMany({
        where: { column_id: dto.column_id, order: { gte: dto.order } },
        data: { order: { increment: 1 } },
      });

      const task = await tx.trackerTask.create({
        data: {
          title: dto.title,
          description: dto.description,
          order: dto.order,
          column_id: dto.column_id,
          subtasks: dto.subtasks ? {
            create: dto.subtasks.map(s => ({
              title: s.title,
              completed: s.completed ?? false,
            })),
          } : undefined,
        },
        include: { subtasks: true, column: { include: { board: true } } },
      });

      // Notify the student if the task was created by an admin/teacher
      if (requester_id !== student_id) {
        await tx.notification.create({
          data: {
            user_id: student_id,
            message_id: student_id, // requested logic: message_id is the student ID
            message_title: task.title,
            message_type: 'task',
            message: 'new_task_created',
            payload: { task_id: task.id },
          },
        });
      }

      return task;
    });
  }

  async update_task(task_id: string, requester_id: string, requester_role: Role, dto: UpdateTaskDto) {
    const task = await this.prisma.trackerTask.findUnique({
      where: { id: task_id },
      include: { 
        column: { 
          include: { 
            board: {
              include: { student: true }
            } 
          } 
        } 
      },
    });
    if (!task) throw new NotFoundException('Task not found');

    if (dto.title !== undefined || dto.description !== undefined) {
      await this.check_edit_permission(task.column.board.student_id, requester_id, requester_role);
    } else {
      await this.check_board_access(task.column.board.student_id, requester_id, requester_role);
    }

    const old_column_id = task.column_id;
    const old_order = task.order;
    const new_column_id = dto.column_id ?? old_column_id;
    const new_order = dto.order !== undefined ? dto.order : old_order;

    if (old_column_id === new_column_id && old_order === new_order && !dto.title && !dto.description) {
      return task;
    }

    return this.prisma.$transaction(async (tx) => {
      if (old_column_id !== new_column_id) {
        // Moved to a different column
        // 1. Shift tasks in old column up to fill the gap
        await tx.trackerTask.updateMany({
          where: { column_id: old_column_id, order: { gt: old_order } },
          data: { order: { decrement: 1 } },
        });

        // 2. Shift tasks in new column down to make room
        await tx.trackerTask.updateMany({
          where: { column_id: new_column_id, order: { gte: new_order } },
          data: { order: { increment: 1 } },
        });
      } else if (old_order !== new_order) {
        // Moved within the same column
        if (new_order < old_order) {
          // Moving up: shift tasks between new and old down
          await tx.trackerTask.updateMany({
            where: {
              column_id: old_column_id,
              order: { gte: new_order, lt: old_order },
            },
            data: { order: { increment: 1 } },
          });
        } else {
          // Moving down: shift tasks between old and new up
          await tx.trackerTask.updateMany({
            where: {
              column_id: old_column_id,
              order: { gt: old_order, lte: new_order },
            },
            data: { order: { decrement: 1 } },
          });
        }
      }

      const updated_task = await tx.trackerTask.update({
        where: { id: task_id },
        data: {
          title: dto.title,
          description: dto.description,
          order: new_order,
          column_id: new_column_id,
        },
        include: { subtasks: true },
      });

      // If the column changed and the requester is the student, notify the admin/teacher
      if (old_column_id !== new_column_id && requester_id === task.column.board.student_id) {
        const admin_id = task.column.board.super_admin_id;
        if (admin_id) {
          await tx.notification.create({
            data: {
              user_id: admin_id,
              message_id: task.column.board.student_id, // requested logic: message_id is the student ID
              message_title: task.column.board.student.name,
              message_type: 'user',
              message: 'task_column_changed',
              payload: { 
                task_id: updated_task.id, 
                task_title: updated_task.title,
                task_name: updated_task.title,
                student_id: task.column.board.student_id,
                column_id: new_column_id
              },
            },
          });
        }
      }

      return updated_task;
    });
  }

  async delete_task(task_id: string, requester_id: string, requester_role: Role) {
    const task = await this.prisma.trackerTask.findUnique({
      where: { id: task_id },
      include: { column: { include: { board: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.check_edit_permission(task.column.board.student_id, requester_id, requester_role);

    return this.prisma.$transaction(async (tx) => {
      await tx.trackerTask.delete({ where: { id: task_id } });

      await tx.trackerTask.updateMany({
        where: { column_id: task.column_id, order: { gt: task.order } },
        data: { order: { decrement: 1 } },
      });

      return { message: 'Task deleted successfully' };
    });
  }

  async toggle_subtask(subtask_id: string, requester_id: string, requester_role: Role) {
    const subtask = await this.prisma.trackerSubtask.findUnique({
      where: { id: subtask_id },
      include: { task: { include: { column: { include: { board: true } } } } },
    });
    if (!subtask) throw new NotFoundException('Subtask not found');

    await this.check_board_access(subtask.task.column.board.student_id, requester_id, requester_role);

    return this.prisma.trackerSubtask.update({
      where: { id: subtask_id },
      data: { completed: !subtask.completed },
    });
  }

  async create_subtask(task_id: string, requester_id: string, requester_role: Role, dto: CreateSubtaskDto) {
    const task = await this.prisma.trackerTask.findUnique({
      where: { id: task_id },
      include: { column: { include: { board: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    await this.check_create_permission(task.column.board.student_id, requester_id, requester_role);

    return this.prisma.trackerSubtask.create({
      data: {
        title: dto.title,
        completed: dto.completed ?? false,
        task_id,
      },
    });
  }

  async delete_subtask(subtask_id: string, requester_id: string, requester_role: Role) {
    const subtask = await this.prisma.trackerSubtask.findUnique({
      where: { id: subtask_id },
      include: { task: { include: { column: { include: { board: true } } } } },
    });
    if (!subtask) throw new NotFoundException('Subtask not found');

    await this.check_edit_permission(subtask.task.column.board.student_id, requester_id, requester_role);

    await this.prisma.trackerSubtask.delete({ where: { id: subtask_id } });
    return { message: 'Subtask deleted successfully' };
  }

  private async check_board_access(student_id: string, requester_id: string, requester_role: Role) {
    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, super_admin_id: true, teacher_id: true },
    });

    if (!student) throw new NotFoundException('Student not found');

    const is_owner = requester_id === student_id;
    const is_super_admin = requester_role === Role.super_admin && student.super_admin_id === requester_id;
    const is_teacher = requester_role === Role.teacher && student.teacher_id === requester_id;

    if (!is_owner && !is_super_admin && !is_teacher) {
      throw new ForbiddenException('You do not have access to this board');
    }
  }

  private async check_create_permission(student_id: string, requester_id: string, requester_role: Role) {
    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, super_admin_id: true, teacher_id: true, can_student_create_tracker: true },
    });

    if (!student) throw new NotFoundException('Student not found');

    const is_owner = requester_id === student_id;
    const is_super_admin = requester_role === Role.super_admin && student.super_admin_id === requester_id;
    const is_teacher = requester_role === Role.teacher && student.teacher_id === requester_id;

    if (is_super_admin || is_teacher) return; // Admins and teachers can always create

    if (is_owner) {
      if (student.can_student_create_tracker) return;
      throw new ForbiddenException('You do not have permission to create items in the tracker');
    }

    throw new ForbiddenException('Unauthorized access to tracker');
  }

  private async check_edit_permission(student_id: string, requester_id: string, requester_role: Role) {
    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, super_admin_id: true, teacher_id: true, can_student_edit_tracker: true },
    });

    if (!student) throw new NotFoundException('Student not found');

    const is_owner = requester_id === student_id;
    const is_super_admin = requester_role === Role.super_admin && student.super_admin_id === requester_id;
    const is_teacher = requester_role === Role.teacher && student.teacher_id === requester_id;

    if (is_super_admin || is_teacher) return; // Admins and teachers can always edit

    if (is_owner) {
      if (student.can_student_edit_tracker) return;
      throw new ForbiddenException('You do not have permission to edit tracker items');
    }

    throw new ForbiddenException('Unauthorized access to tracker');
  }
}
