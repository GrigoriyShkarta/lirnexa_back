import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ──────────────────────────────────────────────
// Settings DTO
// ──────────────────────────────────────────────

export class BoardSettingsDto {
  @ApiPropertyOptional({
    description: "Background color: 'auto' or HEX string",
    example: '#ffffff',
  })
  @IsOptional()
  @IsString()
  bg_color?: string;

  @ApiPropertyOptional({
    description: 'Grid overlay type',
    enum: ['cells', 'dots', 'none'],
    example: 'dots',
  })
  @IsOptional()
  @IsIn(['cells', 'dots', 'none'])
  grid_type?: 'cells' | 'dots' | 'none';

  @ApiPropertyOptional({
    description: 'Board theme preference',
    enum: ['auto', 'light', 'dark'],
    example: 'auto',
  })
  @IsOptional()
  @IsIn(['auto', 'light', 'dark'])
  board_theme?: 'auto' | 'light' | 'dark';
}

// ──────────────────────────────────────────────
// Create Board DTO
// ──────────────────────────────────────────────

export class CreateBoardDto {
  @ApiProperty({
    description: 'ID of the student this board is for',
    example: 'a1b2c3d4-...',
  })
  @IsUUID()
  student_id: string;

  @ApiPropertyOptional({
    description: 'Board display title',
    example: 'Lesson Plan',
  })
  @IsOptional()
  @IsString()
  title?: string;
}

// ──────────────────────────────────────────────
// Update Board DTO
// ──────────────────────────────────────────────

export class UpdateBoardDto {
  @ApiPropertyOptional({ description: 'New board title', example: 'Session 5' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Board display settings',
    type: BoardSettingsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BoardSettingsDto)
  settings?: BoardSettingsDto;
}

// ──────────────────────────────────────────────
// Element DTOs (passed through as plain JSON)
// ──────────────────────────────────────────────

export class SyncElementsDto {
  @ApiProperty({
    description: 'Full array of board elements to replace current state',
    isArray: true,
    example: [],
  })
  @IsObject({ each: true })
  // any used here because element shapes are highly dynamic (union of 10+ types)
  elements: Record<string, any>[];
}

export class UpdateElementDto {
  @ApiProperty({
    description: 'Partial or full updated element objects (delta)',
    isArray: true,
    example: [{ id: 'uuid', x: 120, y: 200 }],
  })
  @IsObject({ each: true })
  // any used here because element shapes are highly dynamic (union of 10+ types)
  elements: Record<string, any>[];
}

export class CreateElementDto {
  @ApiProperty({
    description: 'New element to add to the board',
    example: { id: 'uuid', type: 'text', content: 'Hello', x: 0, y: 0, w: 200, h: 50 },
  })
  @IsObject()
  // any used here because element shape depends on type discriminator
  element: Record<string, any>;
}

export class DeleteElementsDto {
  @ApiProperty({
    description: 'Array of element IDs to delete',
    example: ['id-1', 'id-2'],
    isArray: true,
  })
  @IsString({ each: true })
  ids: string[];
}

// ──────────────────────────────────────────────
// Response DTOs
// ──────────────────────────────────────────────

export class BoardSettingsResponse {
  @ApiProperty() bg_color: string;
  @ApiProperty() grid_type: string;
  @ApiProperty() board_theme: string;
}

export class BoardResponse {
  @ApiProperty() id: string;
  @ApiProperty() student_id: string;
  @ApiProperty() super_admin_id: string;
  @ApiProperty() title: string;
  @ApiProperty({ type: BoardSettingsResponse }) settings: BoardSettingsResponse;
  @ApiProperty() preview_url?: string;
  @ApiProperty({ isArray: true }) elements: Record<string, any>[];
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class BoardListResponse {
  @ApiProperty({ type: [BoardResponse] }) boards: BoardResponse[];
}
