import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePhotoBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of photo names or a single name string', 
    example: ['Photo 1', 'Photo 2'] 
  })
  names: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'Photo files to upload' 
  })
  files: any[];
}

export class UpdatePhotoBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of photo IDs to update', 
    example: ['uuid1', 'uuid2'] 
  })
  ids: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of new photo names', 
    example: ['New Name 1', 'New Name 2'] 
  })
  names: string | string[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'New photo files (optional, matched by index to IDs)' 
  })
  files?: any[];
}
