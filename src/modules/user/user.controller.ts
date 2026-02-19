import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  UseGuards,
  Patch,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UserProfileResponse, UserListItemResponse, PaginatedUserListResponse } from './dto/user-profile.response';
import { UserQueryDto } from './dto/user-query.dto';

@ApiTags('User Management')
@UseGuards(AuthGuard)
@Controller('users')
/**
 * Controller for managing user accounts.
 */
export class UserController {
  constructor(private user_service: UserService) {}

  @Post()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new user (Super Admin, Admin, Teacher only)' })
  async create_user(
    @Req() req: RequestWithUser,
    @Body() dto: CreateUserDto,
    @UploadedFile() avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.user_service.create_user(req.user.sub, req.user.role, dto, avatar_file);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully', type: UserProfileResponse })
  async get_me(@Req() req: RequestWithUser): Promise<UserProfileResponse> {
    return this.user_service.get_me(req.user.sub);
  }

  @Patch('me')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update current user profile' })
  async update_me(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateMeDto,
    @UploadedFile() avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.user_service.update_me(req.user.sub, dto, avatar_file);
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change current user password' })
  async change_password(
    @Req() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.user_service.change_password(req.user.sub, dto);
  }

  @Get()
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'List users based on role and hierarchy' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of users retrieved successfully',
    type: PaginatedUserListResponse,
  })
  async get_users(
    @Req() req: RequestWithUser,
    @Query() query: UserQueryDto,
  ): Promise<PaginatedUserListResponse> {
    return this.user_service.get_users(req.user.sub, req.user.role, query);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update an existing user' })
  async update_user(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatar_file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.user_service.update_user(req.user.sub, req.user.role, id, dto, avatar_file);
  }

  @Delete(':id')
  @Roles(Role.super_admin, Role.admin, Role.teacher)
  @ApiOperation({ summary: 'Delete a user' })
  async delete_user(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.user_service.delete_user(req.user.sub, req.user.role, id);
  }
}
