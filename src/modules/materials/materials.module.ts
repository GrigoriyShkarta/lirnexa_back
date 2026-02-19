import { Module } from '@nestjs/common';
import { AudioModule } from './audio/audio.module';
import { PhotoModule } from './photo/photo.module';
import { VideoModule } from './video/video.module';
import { FilesModule } from './files/files.module';
import { LessonModule } from './lesson/lesson.module';
import { CourseModule } from './course/course.module';
import { ContentCleanupModule } from './content-cleanup.module';

@Module({
  imports: [
    AudioModule,
    PhotoModule,
    VideoModule,
    FilesModule,
    LessonModule,
    CourseModule,
    ContentCleanupModule
  ],
})
export class MaterialsModule {}

