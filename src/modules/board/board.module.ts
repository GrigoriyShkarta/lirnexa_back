import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BoardController } from './board.controller';
import { BoardGateway } from './board.gateway';
import { BoardService } from './board.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    AuthModule,
    JwtModule,
    StorageModule,
  ],
  providers: [BoardService, BoardGateway],
  controllers: [BoardController],
  exports: [BoardService],
})
export class BoardModule {}
