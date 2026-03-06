import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './space.service';
import { SafeSpaceDto } from './dto/save-space.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, Personalization } from '@prisma/client';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { AuthGuard } from '../auth/guards/auth.guard';

@ApiTags('Space Customization')
@UseGuards(AuthGuard)
@Controller('space')
/**
 * Controller for managing space customization.
 */
export class SpaceController {
  constructor(private space_service: SpaceService) {}

  @Get()
  @ApiOperation({ summary: 'Get current space settings based on user hierarchy' })
  async get_space(@Req() req: RequestWithUser): Promise<Personalization | Partial<Personalization>> {
    return this.space_service.get_space(req.user.sub, req.user.role);
  }

  @Post()
  @Roles(Role.super_admin)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'icon', maxCount: 1 },
    { name: 'student_dashboard_hero_image', maxCount: 1 },
    { name: 'dashboard_hero_image', maxCount: 1 },
  ]))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Save space settings (Super Admin only)' })
  @ApiBody({ type: SafeSpaceDto })
  async save_space(
    @Req() req: RequestWithUser,
    @Body() dto: SafeSpaceDto,
    @UploadedFiles() files: {
      icon?: Express.Multer.File[],
      student_dashboard_hero_image?: Express.Multer.File[],
      dashboard_hero_image?: Express.Multer.File[],
    },
  ): Promise<{ message: string }> {
    return this.space_service.save_space(
      req.user.sub,
      dto,
      files?.icon?.[0],
      files?.student_dashboard_hero_image?.[0],
      files?.dashboard_hero_image?.[0],
    );
  }
}
