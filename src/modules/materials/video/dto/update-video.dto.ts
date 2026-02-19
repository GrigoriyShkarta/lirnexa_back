import { CreateVideoDto } from './create-video.dto';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class UpdateVideoDto extends PartialType(CreateVideoDto) {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'New video file' })
  file?: any;
}
