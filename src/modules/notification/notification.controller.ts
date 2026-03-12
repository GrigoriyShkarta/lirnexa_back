import { Controller, Patch, Param, Req, UseGuards, Post, Body, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RequestWithUser } from '../auth/interfaces/request-with-user.interface';
import { NotificationService } from './notification.service';
import { BulkUpdateNotificationsDto } from './dto/notification.dto';

@ApiTags('Notification Management')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('notifications')
/**
 * Controller for managing user notifications.
 */
export class NotificationController {
  constructor(private notification_service: NotificationService) {}

  @Patch('read/:id')
  @ApiOperation({ summary: 'Mark specific notification as read' })
  @ApiResponse({ status: 200, description: 'Success' })
  async mark_as_read(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.notification_service.markAsRead(req.user.sub, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all user notifications as read' })
  @ApiResponse({ status: 200, description: 'Success' })
  async mark_all_as_read(
    @Req() req: RequestWithUser,
  ): Promise<{ message: string }> {
    return this.notification_service.markAllAsRead(req.user.sub);
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiResponse({ status: 200, description: 'Success' })
  async delete_bulk(
    @Req() req: RequestWithUser,
    @Body() dto: BulkUpdateNotificationsDto,
  ): Promise<{ message: string }> {
    return this.notification_service.deleteBulk(req.user.sub, dto.ids);
  }
}
