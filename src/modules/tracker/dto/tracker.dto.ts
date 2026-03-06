import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubtaskDto {
  @ApiProperty({ example: 'Subtask title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

export class UpdateSubtaskDto {
  @ApiPropertyOptional({ example: 'Updated subtask title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  completed?: boolean;
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Task title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'column-uuid' })
  @IsString()
  @IsNotEmpty()
  column_id: string;

  @ApiPropertyOptional({ type: [CreateSubtaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubtaskDto)
  @IsOptional()
  subtasks?: CreateSubtaskDto[];

  @ApiProperty({ example: 0 })
  @IsNumber()
  order: number;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Updated task title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated task description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'new-column-uuid' })
  @IsString()
  @IsOptional()
  column_id?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  order?: number;
}

export class CreateColumnDto {
  @ApiProperty({ example: 'Column title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ example: 0 })
  @IsNumber()
  order: number;
}

export class UpdateColumnDto {
  @ApiPropertyOptional({ example: 'Updated column title' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: '#ff0000' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  order?: number;
}

export class TrackerBoardResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: () => [TrackerColumnResponse] })
  columns: TrackerColumnResponse[];
}

export class TrackerColumnResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  color: string | null;

  @ApiProperty()
  order: number;

  @ApiProperty({ type: () => [TrackerTaskResponse] })
  tasks: TrackerTaskResponse[];
}

export class TrackerTaskResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  order: number;

  @ApiProperty({ type: () => [TrackerSubtaskResponse] })
  subtasks: TrackerSubtaskResponse[];
}

export class TrackerSubtaskResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  completed: boolean;
}
