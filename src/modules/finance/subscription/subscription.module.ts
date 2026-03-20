import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { GoogleCalendarModule } from '../../integrations/google-calendar/google-calendar.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [PrismaModule, AuthModule, GoogleCalendarModule, StorageModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
