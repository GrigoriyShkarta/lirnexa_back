import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAudioBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of audio names or a single name string', 
    example: ['Audio 1', 'Audio 2'] 
  })
  names: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'Audio files to upload' 
  })
  files: any[];
}

export class UpdateAudioBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of audio IDs to update', 
    example: ['uuid1', 'uuid2'] 
  })
  ids: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of new audio names', 
    example: ['New Name 1', 'New Name 2'] 
  })
  names: string | string[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'New audio files (optional, matched by index to IDs)' 
  })
  files?: any[];
}
