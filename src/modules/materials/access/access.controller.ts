import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { AccessService } from './access.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { RevokeAccessDto } from './dto/revoke-access.dto';
import { MaterialAccessResponseDto } from './dto/access-response.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role, MaterialType } from '@prisma/client';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Materials - Access')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('materials/access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Post('grant')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Grant access to materials' })
  @ApiOkResponse({ type: [MaterialAccessResponseDto] })
  async grant(@Req() req: RequestWithUser, @Body() dto: GrantAccessDto) {
    return this.accessService.grant_access(req.user.sub, dto);
  }

  @Delete('revoke')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Revoke access to materials' })
  @ApiResponse({ status: 204, description: 'Access revoked successfully' })
  async revoke(@Body() dto: RevokeAccessDto) {
    return this.accessService.revoke_access(dto.student_ids, dto.material_ids, dto.material_type);
  }

  @Get('student/:id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Get all material access for a specific student' })
  @ApiOkResponse({ type: [MaterialAccessResponseDto] })
  async getStudentAccess(@Param('id') id: string) {
    return this.accessService.get_student_access(id);
  }
}
