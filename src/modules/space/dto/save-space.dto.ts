import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for saving space customization settings.
 */
export class SafeSpaceDto {
  @ApiProperty({ example: 'My School', description: 'Name of the space' })
  @IsString()
  @IsNotEmpty()
  title_space: string;

  @ApiProperty({ example: ['uk', 'en'], description: 'List of available languages' })
  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @ApiProperty({ example: true, description: 'Toggle light/dark mode switch' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  select_mode: boolean;

  @ApiProperty({ example: 'white', description: 'Background color for light theme' })
  @IsString()
  @IsNotEmpty()
  bg_color: string;

  @ApiProperty({ example: 'blue', description: 'Primary component color' })
  @IsString()
  @IsNotEmpty()
  primary_color: string;

  @ApiProperty({ example: 'gray', description: 'Secondary component color' })
  @IsString()
  @IsNotEmpty()
  secondary_color: string;

  @ApiProperty({ example: 'dark', description: 'Background color for dark theme' })
  @ValidateIf((o) => o.select_mode === true)
  @IsNotEmpty({ message: 'bg_color_dark_is_required_when_select_mode_is_true' })
  bg_color_dark: string;

  @ApiProperty({ example: true, description: 'Toggle white sidebar color switch' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_white_sidebar_color: boolean;

  @ApiProperty({ example: true, description: 'Toggle show sidebar icon switch' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_show_sidebar_icon: boolean;

  @ApiProperty({ example: 'inter', description: 'Font family' })
  @IsString()
  @IsNotEmpty()
  font_family: string;
}
