import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsOptional, IsUrl, IsArray } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ example: 'Tutorial Video', description: 'Name of the video' })
  @IsString()
  @IsNotEmpty({ message: 'video_name_required' })
  name: string;

  @ApiProperty({ example: 'https://youtube.com/...', description: 'URL of the video (if it is a link)', required: false })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiProperty({ example: 'uuid', description: 'Category ID' })
  @IsString()
  @IsOptional()
  category_id?: string;

  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'Category IDs' })
  @Transform(({ value }) => {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value;
    return value;
  })
  @IsArray({ message: 'categories_must_be_an_array' })
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}
