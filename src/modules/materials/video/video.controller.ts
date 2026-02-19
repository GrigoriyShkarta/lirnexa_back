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
import { VideoService } from './video.service';
import { VideoQueryDto } from './dto/video-query.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { CreateVideoBulkDto, UpdateVideoBulkDto } from './dto/bulk-video.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedVideoResponseDto } from './dto/video-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Video')
@UseGuards(AuthGuard)
@Controller('materials/video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get()
  @ApiOperation({ summary: 'Get all videos with pagination and search' })
  @ApiOkResponse({ type: PaginatedVideoResponseDto })
  async get_all(
    @Req() req: RequestWithUser,
    @Query() query: VideoQueryDto,
  ) {
    return this.videoService.get_all(req.user.sub, query);
  }

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateVideoBulkDto })
  @ApiOperation({ summary: 'Create multiple videos (files or links)' })
  async create_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const names = body.names || body.name; 
    const urls = body.urls || body.url || body.youtube_url || body.video_url;
    const categories = body.categories || body.category_id;
    return this.videoService.create_bulk(req.user.sub, names, urls, files, categories);
  }

  @Patch('bulk')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateVideoBulkDto })
  @ApiOperation({ summary: 'Update multiple videos' })
  async update_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const urls = body.urls || body.url || body.youtube_url || body.video_url;
    return this.videoService.update_bulk(req.user.sub, body.ids, body.names, urls, files);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a video record' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto: UpdateVideoDto = {
      ...body,
      url: body.url || body.youtube_url || body.video_url,
    };
    return this.videoService.update_video(req.user.sub, id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a video record' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.videoService.delete_video(req.user.sub, id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple video records' })
  async delete_bulk(
    @Req() req: RequestWithUser,
    @Body('ids') ids: string[],
  ) {
    return this.videoService.delete_bulk(req.user.sub, ids);
  }
}
