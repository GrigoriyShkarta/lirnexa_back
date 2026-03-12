import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarController, GoogleOAuthCallbackController } from './google-calendar.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [GoogleCalendarService],
  controllers: [GoogleCalendarController, GoogleOAuthCallbackController],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
