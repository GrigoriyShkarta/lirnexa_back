import { ApiProperty } from '@nestjs/swagger';
import { MaterialBaseResponseDto } from '../../dto/material-base.response';

export class VideoResponseDto extends MaterialBaseResponseDto {
  @ApiProperty()
  is_link: boolean;
}

export class PaginatedVideoResponseDto {
  @ApiProperty({ type: [VideoResponseDto] })
  data: VideoResponseDto[];

  @ApiProperty()
  meta: any;
}
