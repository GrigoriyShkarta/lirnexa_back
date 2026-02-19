import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVideoBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of video names', 
    example: ['Video 1', 'Video 2'] 
  })
  names: string | string[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of video URLs (links). Leave null/empty at index if it is a file upload.', 
    example: ['https://youtube.com/...', ''] 
  })
  urls?: (string | null)[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'Video files to upload' 
  })
  files?: any[];
}

export class UpdateVideoBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of video IDs to update', 
    example: ['uuid1', 'uuid2'] 
  })
  ids: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of new video names', 
    example: ['New Name 1', 'New Name 2'] 
  })
  names: string | string[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of new video URLs (links)', 
    example: ['https://newlink.com/...', ''] 
  })
  urls?: (string | null)[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'New video files' 
  })
  files?: any[];
}
