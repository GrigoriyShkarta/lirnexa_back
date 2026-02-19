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
import { AudioService } from './audio.service';
import { AudioQueryDto } from './dto/audio-query.dto';
import { UpdateAudioDto } from './dto/update-audio.dto';
import { CreateAudioBulkDto, UpdateAudioBulkDto } from './dto/bulk-audio.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedAudioResponseDto } from './dto/audio-response.dto';
import { MaterialBaseResponseDto } from '../dto/material-base.response';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Audio')
@UseGuards(AuthGuard)
@Controller('materials/audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audios with pagination and search' })
  @ApiOkResponse({ type: PaginatedAudioResponseDto })
  async get_all(
    @Req() req: RequestWithUser,
    @Query() query: AudioQueryDto,
  ) {
    return this.audioService.get_all(req.user.sub, query);
  }

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateAudioBulkDto })
  @ApiOperation({ summary: 'Create multiple audios' })
  async create_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    // Поддержка и 'name' и 'names' для удобства фронтенда
    const names = body.names || body.name;
    const categories = body.categories || body.category_id;
    return this.audioService.create_bulk(req.user.sub, names, files, categories);
  }

  @Patch('bulk')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateAudioBulkDto })
  @ApiOperation({ summary: 'Update multiple audios' })
  async update_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.audioService.update_bulk(req.user.sub, body.ids, body.names, files);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an audio record' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateAudioDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.audioService.update_audio(req.user.sub, id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete an audio record' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.audioService.delete_audio(req.user.sub, id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple audio records' })
  async delete_bulk(
    @Req() req: RequestWithUser,
    @Body('ids') ids: string[],
  ) {
    return this.audioService.delete_bulk(req.user.sub, ids);
  }
}
