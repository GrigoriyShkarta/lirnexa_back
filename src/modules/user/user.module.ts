import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { UserTasksService } from './user-tasks.service';
import { GoogleCalendarModule } from '../integrations/google-calendar/google-calendar.module';
import { StreamModule } from '../integrations/stream/stream.module';
import { TestsModule } from '../tests/tests.module';

@Module({
  imports: [AuthModule, StorageModule, GoogleCalendarModule, StreamModule, TestsModule],
  providers: [UserService, UserTasksService],
  controllers: [UserController],
})
/**
 * Module for user management.
 */
export class UserModule {}
