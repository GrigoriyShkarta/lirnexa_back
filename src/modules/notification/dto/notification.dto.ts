import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class BulkUpdateNotificationsDto {
  @ApiProperty({ example: ['uuid-1', 'uuid-2'], description: 'Array of notification IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  ids: string[];
}
