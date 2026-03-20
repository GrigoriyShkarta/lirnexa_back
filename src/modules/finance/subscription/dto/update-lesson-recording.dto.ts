import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateLessonRecordingDto {
  @ApiProperty({ example: 'https://example.com/recording.mp4', description: 'URL or iframe of the new recording' })
  @IsString()
  @IsNotEmpty()
  recording_url: string;
}
