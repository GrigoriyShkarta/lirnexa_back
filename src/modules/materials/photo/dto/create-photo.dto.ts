import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreatePhotoDto {
  @ApiProperty({ example: 'Beach Photo', description: 'Name of the photo' })
  @IsString()
  @IsNotEmpty({ message: 'photo_name_required' })
  name: string;

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
