import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for space customization data.
 */
export class SpaceResponse {
  @ApiProperty({ example: 'uuid-string', description: 'Space unique identifier' })
  id: string;

  @ApiProperty({ example: 'Lirnexa', description: 'Name of the space' })
  title_space: string;

  @ApiProperty({ example: 'icon-url', description: 'Space icon URL' })
  icon: string;

  @ApiProperty({ example: ['uk'], description: 'Available languages' })
  languages: string[];

  @ApiProperty({ example: false, description: 'Selection mode enabled' })
  select_mode: boolean;

  @ApiProperty({ example: 'white', description: 'Background color' })
  bg_color: string;

  @ApiProperty({ example: 'blue', description: 'Primary color' })
  primary_color: string;

  @ApiProperty({ example: 'gray', description: 'Secondary color' })
  secondary_color: string;

  @ApiProperty({ example: 'dark', description: 'Dark mode background color' })
  bg_color_dark: string;

  @ApiProperty({ example: true, description: 'Toggle white sidebar color switch' })
  is_white_sidebar_color: boolean;

  @ApiProperty({ example: true, description: 'Toggle show sidebar icon switch' })
  is_show_sidebar_icon: boolean;

  @ApiProperty({ example: 'inter', description: 'Font family' })
  font_family: string;
}
