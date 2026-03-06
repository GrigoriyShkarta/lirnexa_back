import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class BulkDeleteUsersDto {
  @ApiProperty({
    example: ['uuid1', 'uuid2'],
    description: 'Array of user IDs to delete',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  ids: string[];
}
