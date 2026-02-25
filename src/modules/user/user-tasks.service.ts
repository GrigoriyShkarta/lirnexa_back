import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UserTasksService {
  private readonly logger = new Logger(UserTasksService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Automatically deactivates users whose deactivation_date has passed.
   * Runs every day at midnight (00:00).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleUserDeactivation() {
    this.logger.log('Starting scheduled user deactivation check...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const result = await this.prisma.user.updateMany({
        where: {
          status: UserStatus.active,
          deactivation_date: {
            lte: today,
          },
        },
        data: {
          status: UserStatus.inactive,
        },
      });

      if (result.count > 0) {
        this.logger.log(`Successfully deactivated ${result.count} users.`);
      } else {
        this.logger.log('No users to deactivate today.');
      }
    } catch (error) {
      this.logger.error('Error during scheduled user deactivation:', error);
    }
  }
}
