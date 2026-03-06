import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ example: 'UAH', description: 'Default currency' })
  currency: string;
}

/**
 * Response DTO for dashboard-specific settings.
 */
export class DashboardPersonalizationResponse {
  @ApiPropertyOptional({ example: 'Привіт, {name}!', description: 'Student dashboard title' })
  student_dashboard_title: string | null;

  @ApiPropertyOptional({ example: 'Готовий до уроку?', description: 'Student dashboard description' })
  student_dashboard_description: string | null;

  @ApiPropertyOptional({ example: 'http://example.com/hero.jpg', description: 'Student dashboard hero image' })
  student_dashboard_hero_image: string | null;

  @ApiPropertyOptional({ example: 'Увага!', description: 'Student announcement' })
  student_announcement: string | null;

  @ApiProperty({ example: false, description: 'Show student progress' })
  is_show_student_progress: boolean;

  @ApiPropertyOptional({ example: '@instagram', description: 'Instagram handle' })
  student_social_instagram: string | null;

  @ApiPropertyOptional({ example: '@telegram', description: 'Telegram handle' })
  student_support_telegram: string | null;

  @ApiPropertyOptional({ example: 'Admin Dashboard', description: 'Admin dashboard title' })
  dashboard_title: string | null;

  @ApiPropertyOptional({ example: 'Manage your school', description: 'Admin dashboard description' })
  dashboard_description: string | null;

  @ApiPropertyOptional({ example: 'http://example.com/admin_hero.jpg', description: 'Admin hero image' })
  dashboard_hero_image: string | null;
}
