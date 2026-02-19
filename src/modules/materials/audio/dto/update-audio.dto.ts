import { CreateAudioDto } from './create-audio.dto';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class UpdateAudioDto extends PartialType(CreateAudioDto) {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'New audio file' })
  file?: any;
}
