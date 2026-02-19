import { Module, Global } from '@nestjs/common';
import { ContentCleanupService } from './content-cleanup.service';

@Global()
@Module({
  providers: [ContentCleanupService],
  exports: [ContentCleanupService],
})
export class ContentCleanupModule {}
