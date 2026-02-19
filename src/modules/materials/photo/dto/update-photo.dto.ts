import { CreatePhotoDto } from './create-photo.dto';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class UpdatePhotoDto extends PartialType(CreatePhotoDto) {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'New photo file' })
  file?: any;
}
