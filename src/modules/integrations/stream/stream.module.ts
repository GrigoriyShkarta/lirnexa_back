import { Module } from '@nestjs/common';
import { StreamService } from './stream.service';
import { ConfigModule } from '@nestjs/config';
import { StreamController } from './stream.controller'

@Module({
  imports: [ConfigModule],
  providers: [StreamService],
  controllers: [StreamController],
  exports: [StreamService],
})
export class StreamModule {}
