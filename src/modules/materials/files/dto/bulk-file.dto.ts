import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFileBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of file names or a single name string', 
    example: ['File 1', 'File 2'] 
  })
  names: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'Files to upload' 
  })
  files: any[];
}

export class UpdateFileBulkDto {
  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of file IDs to update', 
    example: ['uuid1', 'uuid2'] 
  })
  ids: string | string[];

  @ApiProperty({ 
    type: 'array', 
    items: { type: 'string' }, 
    description: 'Array of new file names', 
    example: ['New Name 1', 'New Name 2'] 
  })
  names: string | string[];

  @ApiPropertyOptional({ 
    type: 'array', 
    items: { type: 'string', format: 'binary' }, 
    description: 'New files (optional, matched by index to IDs)' 
  })
  files?: any[];
}
