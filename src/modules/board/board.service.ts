import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { Role } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  CreateBoardDto,
  UpdateBoardDto,
  BoardResponse,
} from './dto/board.dto';
import { BoardElement, BoardSettings } from './interfaces/board-element.interface';

@Injectable()
/**
 * Service responsible for all board CRUD and element mutation logic.
 * The board is primarily linked to a student and their workspace (super_admin).
 */
export class BoardService {
  private readonly logger = new Logger(BoardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // REST operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all boards belonging to a specific student.
   * @param student_id Target student ID.
   * @param requester_id Requesting user ID.
   * @param requester_role Requesting user role.
   */
  async find_all_for_student(
    student_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<BoardResponse[]> {
    await this.check_board_access(student_id, requester_id, requester_role);

    try {
      const boards = await this.prisma.board.findMany({
        where: { student_id },
        orderBy: { created_at: 'desc' },
      });

      return boards as unknown as BoardResponse[];
    } catch (error) {
      this.handle_error(error, 'find_all_for_student');
    }
  }

  /**
   * Returns a single board with all its elements.
   * @param board_id Board UUID.
   * @param requester_id Requesting user ID.
   * @param requester_role Requesting user role.
   */
  async find_one(
    board_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    await this.check_board_access(board.student_id, requester_id, requester_role);

    return board as unknown as BoardResponse;
  }

  /**
   * Creates a new empty board for a student.
   * @param dto Board creation payload (student_id + title).
   * @param requester_id Admin/Teacher ID.
   * @param requester_role Requesting user role.
   */
  async create(
    dto: CreateBoardDto,
    requester_id: string,
    requester_role: Role,
  ): Promise<BoardResponse> {
    // 1. Authorization: students only for themselves, staff for others
    if (requester_role === Role.student && dto.student_id !== requester_id) {
      throw new ForbiddenException('unauthorized');
    }

    const student = await this.prisma.user.findUnique({
      where: { id: dto.student_id },
      select: { super_admin_id: true, teacher_id: true },
    });

    if (!student) throw new NotFoundException('student_not_found');

    // Security: staff MUST be the student's admin/teacher
    if (requester_role === Role.super_admin && student.super_admin_id !== requester_id) {
      throw new ForbiddenException('unauthorized_for_this_student');
    }
    if (requester_role === Role.teacher && student.teacher_id !== requester_id) {
      throw new ForbiddenException('unauthorized_for_this_student');
    }

    const default_settings: BoardSettings = {
      bg_color: 'auto',
      grid_type: 'none',
      board_theme: 'auto',
    };

    try {
      const board = await this.prisma.board.create({
        data: {
          student_id: dto.student_id,
          super_admin_id: student.super_admin_id,
          title: dto.title ?? 'Untitled Board',
          settings: default_settings as unknown as Prisma.InputJsonValue,
          elements: [] as unknown as Prisma.InputJsonValue,
        },
      });

      return board as unknown as BoardResponse;
    } catch (error) {
      this.handle_error(error, 'create');
    }
  }

  /**
   * Updates board metadata (title/settings).
   */
  async update(
    board_id: string,
    dto: UpdateBoardDto,
    requester_id: string,
    requester_role: Role,
  ): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    await this.check_board_access(board.student_id, requester_id, requester_role);

    try {
      const current_settings = board.settings as unknown as BoardSettings;
      const merged_settings: BoardSettings = dto.settings
        ? { ...current_settings, ...dto.settings }
        : current_settings;

      const updated = await this.prisma.board.update({
        where: { id: board_id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          settings: merged_settings as unknown as Prisma.InputJsonValue,
          updated_at: new Date(),
        },
      });

      return updated as unknown as BoardResponse;
    } catch (error) {
      this.handle_error(error, 'update');
    }
  }

  /**
   * Deletes a board and its assets.
   */
  async delete(
    board_id: string,
    requester_id: string,
    requester_role: Role,
  ): Promise<{ message: string }> {
    const board = await this.find_board_or_throw(board_id);
    
    await this.check_board_access(board.student_id, requester_id, requester_role);

    // Asset cleanup
    await this.cleanup_board_assets(board.elements as unknown as BoardElement[]);

    try {
      await this.prisma.board.delete({ where: { id: board_id } });
      return { message: 'board_deleted' };
    } catch (error) {
      this.handle_error(error, 'delete');
    }
  }

  /**
   * Uploads a file asset for a board element.
   */
  async upload_file(
    board_id: string,
    requester_id: string,
    requester_role: Role,
    file: Express.Multer.File,
  ): Promise<{ src: string; name: string; size: number; ext: string }> {
    const board = await this.prisma.board.findUnique({
      where: { id: board_id },
      include: {
        student: {
          select: { id: true, name: true, super_admin_id: true },
        },
      },
    });

    if (!board) throw new NotFoundException('board_not_found');
    await this.check_board_access(board.student_id, requester_id, requester_role);

    if (!file) {
      throw new BadRequestException('no_file_provided');
    }

    // Resolve super_admin info for path
    const sa_id = board.super_admin_id || board.student.super_admin_id;
    let sa_name = 'Admin';
    if (sa_id) {
      const sa = await this.prisma.user.findUnique({
        where: { id: sa_id },
        select: { name: true },
      });
      if (sa) sa_name = sa.name;
    }

    // Sanitize and build structured path: sa_name+id/boards/student_name+id/board_title+id
    const sa_path = `${sa_name.replace(/\s+/g, '_')}${sa_id}`;
    const st_path = `${board.student.name.replace(/\s+/g, '_')}${board.student.id}`;
    const bd_path = `${board.title.replace(/\s+/g, '_')}${board.id}`;
    const full_path = `${sa_path}/boards/${st_path}/${bd_path}`;

    const src = await this.storage.uploadFile(file, full_path);
    const ext = file.originalname.split('.').pop() ?? '';

    return {
      src,
      name: file.originalname,
      size: file.size,
      ext,
    };
  }

  /**
   * Updates the board's thumbnail preview. 
   * Deletes the old preview asset if it exists.
   */
  async update_preview(
    board_id: string,
    requester_id: string,
    requester_role: Role,
    file: Express.Multer.File,
  ): Promise<{ preview_url: string }> {
    const board = await this.prisma.board.findUnique({
      where: { id: board_id },
      include: {
        student: { select: { id: true, name: true, super_admin_id: true } },
      },
    });

    if (!board) throw new NotFoundException('board_not_found');
    await this.check_board_access(board.student_id, requester_id, requester_role);

    if (!file) throw new BadRequestException('no_file_provided');

    // Resolve path (previews subfolder)
    const sa_id = board.super_admin_id || board.student.super_admin_id;
    let sa_name = 'Admin';
    if (sa_id) {
      const sa = await this.prisma.user.findUnique({ where: { id: sa_id }, select: { name: true } });
      if (sa) sa_name = sa.name;
    }

    const sa_path = `${sa_name.replace(/\s+/g, '_')}${sa_id}`;
    const st_path = `${board.student.name.replace(/\s+/g, '_')}${board.student.id}`;
    const bd_path = `${board.title.replace(/\s+/g, '_')}${board.id}`;
    const folder_path = `${sa_path}/boards/${st_path}/${bd_path}/previews`;

    // 1. Cleanup old preview from storage if exists
    if (board.preview_url) {
      try {
        await this.storage.deleteFile(board.preview_url);
      } catch (err) {
        this.logger.warn(`Failed to delete old preview for board ${board_id}`, err);
      }
    }

    // 2. Upload new preview
    const src = await this.storage.uploadFile(file, folder_path);

    // 3. Update DB
    await this.prisma.board.update({
      where: { id: board_id },
      data: { preview_url: src },
    });

    return { preview_url: src };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Element mutations (Gateway)
  // ─────────────────────────────────────────────────────────────────────────

  async sync_elements(board_id: string, elements: BoardElement[]): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    const old_elements = board.elements as unknown as BoardElement[];
    
    // Find removed assets
    const new_ids = new Set(elements.map(e => e.id));
    const removed_elements = old_elements.filter(e => !new_ids.has(e.id));
    await this.cleanup_board_assets(removed_elements);

    return this.prisma.board.update({
      where: { id: board_id },
      data: { elements: elements as any, updated_at: new Date() },
    }) as any;
  }

  async update_elements(board_id: string, changed_elements: BoardElement[]): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    const current = board.elements as unknown as BoardElement[];
    const element_map = new Map(current.map((el) => [el.id, el]));

    for (const changed of changed_elements) {
      const existing = element_map.get(changed.id);
      
      // Cleanup old asset if replaced
      if (existing && 'src' in existing && 'src' in changed && existing.src !== changed.src) {
        await this.cleanup_board_assets([existing as any]);
      }

      element_map.set(changed.id, { ...(existing || {}), ...changed } as any);
    }

    return this.prisma.board.update({
      where: { id: board_id },
      data: { 
        elements: Array.from(element_map.values()) as any,
        updated_at: new Date() 
      },
    }) as any;
  }

  async create_element(board_id: string, element: BoardElement): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    const current = board.elements as unknown as BoardElement[];

    if (current.some((el) => el.id === element.id)) return board as any;

    return this.prisma.board.update({
      where: { id: board_id },
      data: { 
        elements: [...current, element] as any,
        updated_at: new Date() 
      },
    }) as any;
  }

  async delete_elements(board_id: string, ids: string[]): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    const current = board.elements as unknown as BoardElement[];

    const id_set = new Set(ids);
    const elements_to_remove = current.filter((el) => id_set.has(el.id));
    await this.cleanup_board_assets(elements_to_remove);

    const remaining = current.filter((el) => !id_set.has(el.id));

    return this.prisma.board.update({
      where: { id: board_id },
      data: { 
        elements: remaining as any,
        updated_at: new Date() 
      },
    }) as any;
  }

  async update_settings(board_id: string, settings: Partial<BoardSettings>): Promise<BoardResponse> {
    const board = await this.find_board_or_throw(board_id);
    const merged = { ...(board.settings as object), ...settings };

    return this.prisma.board.update({
      where: { id: board_id },
      data: {
        settings: merged as any,
        updated_at: new Date(),
      },
    }) as any;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async find_board_or_throw(board_id: string) {
    const board = await this.prisma.board.findUnique({ where: { id: board_id } });
    if (!board) throw new NotFoundException('board_not_found');
    return board;
  }

  /**
   * Strict access control: Student, their Teacher, or their SuperAdmin.
   */
  private async check_board_access(student_id: string, requester_id: string, requester_role: Role) {
    const student = await this.prisma.user.findUnique({
      where: { id: student_id },
      select: { id: true, super_admin_id: true, teacher_id: true },
    });

    if (!student) throw new NotFoundException('student_not_found');

    const is_owner = requester_id === student_id;
    const is_super_admin = requester_role === Role.super_admin && student.super_admin_id === requester_id;
    const is_teacher = requester_role === Role.teacher && student.teacher_id === requester_id;

    if (!is_owner && !is_super_admin && !is_teacher) {
      throw new ForbiddenException('forbidden');
    }
  }

  private async cleanup_board_assets(elements: BoardElement[]): Promise<void> {
    const asset_types = new Set(['video', 'audio', 'image', 'file']);
    for (const el of elements) {
      // Check for assets with URL stored in 'src'
      const src = (el as any).src;
      if (asset_types.has(el.type) && src) {
        // ONLY delete if the file is specifically located in a /boards/ subfolder.
        // Files linked from the global library (e.g. /materials/photo/...) should be preserved.
        if (src.includes('/boards/')) {
          try {
            await this.storage.deleteFile(src);
            this.logger.log(`[Asset] Deleted board-specific asset: ${el.id} (type: ${el.type})`);
          } catch (err) {
            this.logger.error(`Asset cleanup failed for ${el.id}`, err);
          }
        } else {
          this.logger.log(`[Asset] Skipped deletion for shared library asset: ${el.id} (type: ${el.type})`);
        }
      }
    }
  }

  private handle_error(error: unknown, context: string): never {
    if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof BadRequestException) {
      throw error;
    }
    this.logger.error(`BoardService.${context} error`, error instanceof Error ? error.stack : String(error));
    throw new InternalServerErrorException('internal_server_error');
  }
}
