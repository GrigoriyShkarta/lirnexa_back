import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class BulkCategoryDeleteDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'Array of category IDs to delete' })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
