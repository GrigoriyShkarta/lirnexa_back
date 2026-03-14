// stream.controller.ts
import { Controller, Post } from '@nestjs/common';
import { StreamService } from './stream.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('stream')
export class StreamController {
  constructor(private readonly streamService: StreamService) {}

  @Public()
  @Post('setup-custom-layout')
  async setupCustomLayout() {
    await this.streamService.configureDefaultCallTypeCustomLayout();
    return { ok: true };
  }
}