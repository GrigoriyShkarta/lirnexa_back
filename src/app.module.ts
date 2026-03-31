import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { SpaceModule } from './modules/space/space.module';
import { UserModule } from './modules/user/user.module';
import { MaterialsModule } from './modules/materials/materials.module';
import { CategoryModule } from './modules/category/category.module';
import { SubscriptionModule } from './modules/finance/subscription/subscription.module';
import { TrackerModule } from './modules/tracker/tracker.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ScheduleModule } from '@nestjs/schedule';
import { GoogleCalendarModule } from './modules/integrations/google-calendar/google-calendar.module';
import { StreamModule } from './modules/integrations/stream/stream.module';
import { BoardModule } from './modules/board/board.module';
import { TestsModule } from './modules/tests/tests.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    SpaceModule,
    UserModule,
    MaterialsModule,
    CategoryModule,
    SubscriptionModule,
    TrackerModule,
    NotificationModule,
    GoogleCalendarModule,
    StreamModule,
    BoardModule,
    TestsModule,
  ],
})
/**
 * Root module of the application.
 */
export class AppModule {}
