import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { ConfigModule } from '@nestjs/config';
import { StreamController } from './stream.controller';
import { StorageModule } from '../../storage/storage.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [ConfigModule, StorageModule, PrismaModule],
  providers: [StreamService],
  controllers: [StreamController],
  exports: [StreamService],
})
export class StreamModule {}
