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
    await this.runDeactivationWithRetry(3);
  }

  /**
   * Executes the deactivation logic with a specified number of retries.
   * @param retries Number of retries remaining
   * @param delay Delay between retries in milliseconds (default 10s)
   */
  private async runDeactivationWithRetry(retries: number, delay = 10000) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      this.logger.log(`Starting scheduled user deactivation check...`);

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
      const isNetworkError = 
        error.message?.includes('fetch failed') || 
        error.code === 'ENOTFOUND' || 
        error.message?.includes('ENOTFOUND');

      if (retries > 0 && isNetworkError) {
        this.logger.warn(
          `Network error during user deactivation check: ${error.message}. Retrying in ${delay / 1000}s... (${retries} retries left)`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.runDeactivationWithRetry(retries - 1, delay);
      }

      this.logger.error(
        `Failed to complete scheduled user deactivation after all retries. Error: ${error.message}`,
        error.stack
      );
    }
  }
}
