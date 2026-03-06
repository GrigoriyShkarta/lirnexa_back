import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateIf,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({ example: 'UAH', description: 'Default currency' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ example: 'Привіт, {name}!', description: 'Student dashboard title' })
  @IsOptional()
  @IsString()
  student_dashboard_title?: string;

  @ApiProperty({ example: 'Готовий до уроку?', description: 'Student dashboard description' })
  @IsOptional()
  @IsString()
  student_dashboard_description?: string;

  @ApiProperty({ example: 'Увага! 8 березня школа не працює.', description: 'Student announcement' })
  @IsOptional()
  @IsString()
  student_announcement?: string;

  @ApiProperty({ example: true, description: 'Show student progress' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_show_student_progress?: boolean;

  @ApiProperty({ example: 'https://instagram.com/school', description: 'Instagram link' })
  @IsOptional()
  @IsString()
  student_social_instagram?: string;

  @ApiProperty({ example: 'https://t.me/support_bot', description: 'Telegram link' })
  @IsOptional()
  @IsString()
  student_support_telegram?: string;

  @ApiProperty({ example: 'Admin Dashboard', description: 'Admin dashboard title' })
  @IsOptional()
  @IsString()
  dashboard_title?: string;

  @ApiProperty({ example: 'Manage your school', description: 'Admin dashboard description' })
  @IsOptional()
  @IsString()
  dashboard_description?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Student dashboard hero image' })
  @IsOptional()
  student_dashboard_hero_image?: any;

  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Admin dashboard hero image' })
  @IsOptional()
  dashboard_hero_image?: any;
}
