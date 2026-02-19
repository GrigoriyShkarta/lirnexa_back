import { ApiProperty } from '@nestjs/swagger';
import { MaterialBaseResponseDto } from '../../dto/material-base.response';

export class PaginatedFileResponseDto {
  @ApiProperty({ type: [MaterialBaseResponseDto] })
  data: MaterialBaseResponseDto[];

  @ApiProperty()
  meta: any;
}
