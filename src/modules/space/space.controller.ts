import {
  Controller,
  Get,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SpaceService } from './space.service';
import { SafeSpaceDto } from './dto/save-space.dto';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Save space settings (Super Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title_space: { type: 'string' },
        languages: { type: 'array', items: { type: 'string' } },
        select_mode: { type: 'boolean' },
        bg_color: { type: 'string' },
        primary_color: { type: 'string' },
        secondary_color: { type: 'string' },
        bg_color_dark: { type: 'string' },
        icon: { type: 'string', format: 'binary' },
      },
    },
  })
  async save_space(
    @Req() req: RequestWithUser,
    @Body() dto: SafeSpaceDto,
    @UploadedFile() icon_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.space_service.save_space(req.user.sub, dto, icon_file);
  }
}
