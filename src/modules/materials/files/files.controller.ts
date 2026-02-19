import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { FileQueryDto } from './dto/file-query.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { CreateFileBulkDto, UpdateFileBulkDto } from './dto/bulk-file.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedFileResponseDto } from './dto/file-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Files')
@UseGuards(AuthGuard)
@Controller('materials/files')
export class FilesController {

  constructor(private readonly filesService: FilesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all files with pagination and search' })
  @ApiOkResponse({ type: PaginatedFileResponseDto })
  async get_all(
    @Req() req: RequestWithUser,
    @Query() query: FileQueryDto,
  ) {
    return this.filesService.get_all(req.user.sub, query);
  }

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateFileBulkDto })
  @ApiOperation({ summary: 'Create multiple files' })
  async create_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const names = body.names || body.name;
    const categories = body.categories || body.category_id;
    return this.filesService.create_bulk(req.user.sub, names, files, categories);
  }

  @Patch('bulk')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateFileBulkDto })
  @ApiOperation({ summary: 'Update multiple files' })
  async update_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.filesService.update_bulk(req.user.sub, body.ids, body.names, files);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a file record' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.filesService.update_file(req.user.sub, id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a file record' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.filesService.delete_file(req.user.sub, id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple file records' })
  async delete_bulk(
    @Req() req: RequestWithUser,
    @Body('ids') ids: string[],
  ) {
    return this.filesService.delete_bulk(req.user.sub, ids);
  }
}
