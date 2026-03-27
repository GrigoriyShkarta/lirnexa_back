import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { BoardService } from './board.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import {
  CreateBoardDto,
  UpdateBoardDto,
  BoardResponse,
} from './dto/board.dto';

@ApiTags('Boards')
@UseGuards(AuthGuard)
@Controller('boards')
export class BoardController {
  constructor(private readonly board_service: BoardService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns all boards for a given student.
   * @param student_id The student UUID (target owner of the board).
   */
  @Get('student/:student_id')
  @ApiOperation({ summary: 'Get all boards for a student' })
  @ApiParam({ name: 'student_id', description: 'Student UUID' })
  @ApiResponse({ status: 200, type: [BoardResponse] })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async find_all(
    @Param('student_id') student_id: string,
    @Req() req: RequestWithUser,
  ): Promise<BoardResponse[]> {
    return this.board_service.find_all_for_student(student_id, req.user.sub, req.user.role);
  }

  /**
   * Returns a single board by ID including all elements.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a board by ID (full structure with elements)' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, type: BoardResponse })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async find_one(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<BoardResponse> {
    return this.board_service.find_one(id, req.user.sub, req.user.role);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new empty whiteboard in a space.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new board (Staff for students, or students for themselves)' })
  @ApiResponse({ status: 201, type: BoardResponse })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() dto: CreateBoardDto,
    @Req() req: RequestWithUser,
  ): Promise<BoardResponse> {
    return this.board_service.create(dto, req.user.sub, req.user.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update board title or display settings' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, type: BoardResponse })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBoardDto,
    @Req() req: RequestWithUser,
  ): Promise<BoardResponse> {
    return this.board_service.update(id, dto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a board' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiResponse({ status: 200, description: 'Board deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  async delete(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    return this.board_service.delete(id, req.user.sub, req.user.role);
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file asset for a board element' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async upload_file(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ src: string; name: string; size: number; ext: string }> {
    return this.board_service.upload_file(id, req.user.sub, req.user.role, file);
  }

  @Patch(':id/preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Update board thumbnail preview' })
  @ApiParam({ name: 'id', description: 'Board UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Board preview image (screenshot)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Preview updated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update_preview(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ preview_url: string }> {
    return this.board_service.update_preview(id, req.user.sub, req.user.role, file);
  }
}
