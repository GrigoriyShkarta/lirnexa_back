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
import { PhotoService } from './photo.service';
import { PhotoQueryDto } from './dto/photo-query.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { CreatePhotoBulkDto, UpdatePhotoBulkDto } from './dto/bulk-photo.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedPhotoResponseDto } from './dto/photo-response.dto';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Photo')
@UseGuards(AuthGuard)
@Controller('materials/photo')
export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  @Get()
  @ApiOperation({ summary: 'Get all photos with pagination and search' })
  @ApiOkResponse({ type: PaginatedPhotoResponseDto })
  async get_all(
    @Req() req: RequestWithUser,
    @Query() query: PhotoQueryDto,
  ) {
    return this.photoService.get_all(req.user.sub, query);
  }

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreatePhotoBulkDto })
  @ApiOperation({ summary: 'Create multiple photos' })
  async create_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const names = body.names || body.name; 
    const categories = body.categories || body.category_id;
    return this.photoService.create_bulk(req.user.sub, names, files, categories);
  }

  @Patch('bulk')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdatePhotoBulkDto })
  @ApiOperation({ summary: 'Update multiple photos' })
  async update_bulk(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.photoService.update_bulk(req.user.sub, body.ids, body.names, files);
  }

  @Patch(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a photo record' })
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdatePhotoDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.photoService.update_photo(req.user.sub, id, dto, file);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a photo record' })
  async delete(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.photoService.delete_photo(req.user.sub, id);
  }

  @Delete()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete multiple photo records' })
  async delete_bulk(
    @Req() req: RequestWithUser,
    @Body('ids') ids: string[],
  ) {
    return this.photoService.delete_bulk(req.user.sub, ids);
  }
}
