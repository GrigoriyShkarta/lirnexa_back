import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AccessService } from './access.service';
import { AccessController } from './access.controller';

@Module({
  imports: [AuthModule],
  controllers: [AccessController],
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}
