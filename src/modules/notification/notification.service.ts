import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Marks a specific notification as read.
   * @param user_id Current user ID
   * @param notification_id Notification ID to update
   */
  async markAsRead(user_id: string, notification_id: string): Promise<{ message: string }> {
    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id: notification_id },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      if (notification.user_id !== user_id) {
        throw new ForbiddenException('You can only update your own notifications');
      }

      await this.prisma.notification.update({
        where: { id: notification_id },
        data: { is_read: true },
      });

      return { message: 'Notification marked as read' };
    } catch (error) {
      this.logger.error(`Error marking notification as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Marks all user's notifications as read.
   * @param user_id Current user ID
   */
  async markAllAsRead(user_id: string): Promise<{ message: string }> {
    try {
      await this.prisma.notification.updateMany({
        where: { user_id, is_read: false },
        data: { is_read: true },
      });

      return { message: 'All notifications marked as read' };
    } catch (error) {
      this.logger.error(`Error marking all notifications as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Deletes multiple notifications.
   * @param user_id Current user ID
   * @param ids Array of notification IDs to delete
   */
  async deleteBulk(user_id: string, ids: string[]): Promise<{ message: string }> {
    try {
      // Find internal notification records to verify ownership
      const notifications = await this.prisma.notification.findMany({
        where: {
          id: { in: ids },
          user_id: user_id,
        },
        select: { id: true },
      });

      // Filter IDs that belong to the user
      const valid_ids = notifications.map((n) => n.id);

      if (valid_ids.length === 0) {
        return { message: 'No notifications found or access denied' };
      }

      const deletedCount = await this.prisma.notification.deleteMany({
        where: {
          id: { in: valid_ids },
          user_id: user_id,
        },
      });

      return { message: `Successfully deleted ${deletedCount.count} notifications` };
    } catch (error) {
      this.logger.error(`Error deleting notifications bulk: ${error.message}`, error.stack);
      throw error;
    }
  }
}
