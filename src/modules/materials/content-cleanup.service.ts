import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentCleanupService {
  private readonly logger = new Logger(ContentCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cleans up media references (audio, video, photo, file) from Lesson and Course content.
   * Searches for blocks where props.id matches any of the provided mediaIds.
   */
  async cleanupMediaReferences(mediaIds: string[], superAdminId?: string) {
    if (!mediaIds || mediaIds.length === 0) return;

    console.log('Cleaning up media references for mediaIds:', mediaIds);

    try {
      // 1. Cleanup Lessons
      await this.cleanupLessons(mediaIds, superAdminId);

      // 2. Cleanup Courses
      await this.cleanupCourses(mediaIds, superAdminId);

    } catch (error) {
      this.logger.error(`Failed to cleanup media references: ${error.message}`, error.stack);
    }
  }

  private async cleanupLessons(mediaIds: string[], superAdminId?: string) {
    // We only fetch lessons that ACTUALLY contain any of the IDs in their content string.
    // Since Prisma Json filters are complex, we'll use a raw query or a more focused search.
    // For PostgreSQL, we can use the `::text` cast for a fast global search.
    
    for (const id of mediaIds) {
      // Find IDs of lessons that need updating
      const affectedLessons: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM lessons WHERE content::text LIKE $1 ${superAdminId ? 'AND super_admin_id = $2' : ''}`,
        `%${id}%`,
        ...(superAdminId ? [superAdminId] : [])
      );

      if (affectedLessons.length === 0) continue;

      const idsToUpdate = affectedLessons.map(l => l.id);
      const lessons = await this.prisma.lesson.findMany({
        where: { id: { in: idsToUpdate } }
      });

      for (const lesson of lessons) {
        const updatedContent = this.processContent(lesson.content, [id]);
        await this.prisma.lesson.update({
          where: { id: lesson.id },
          data: { content: updatedContent }
        });
        this.logger.log(`Cleaned up reference to ${id} in lesson: ${lesson.id}`);
      }
    }
  }

  private async cleanupCourses(mediaIds: string[], superAdminId?: string) {
    for (const id of mediaIds) {
      const affectedCourses: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM courses WHERE content::text LIKE $1 ${superAdminId ? 'AND super_admin_id = $2' : ''}`,
        `%${id}%`,
        ...(superAdminId ? [superAdminId] : [])
      );

      if (affectedCourses.length === 0) continue;

      const idsToUpdate = affectedCourses.map(c => c.id);
      const courses = await this.prisma.course.findMany({
        where: { id: { in: idsToUpdate } }
      });

      for (const course of courses) {
        const updatedContent = this.processContent(course.content, [id]);
        await this.prisma.course.update({
          where: { id: course.id },
          data: { content: updatedContent }
        });
        this.logger.log(`Cleaned up reference to ${id} in course: ${course.id}`);
      }
    }
  }

  /**
   * Recursively processes the content and removes blocks referencing the media IDs.
   * Handles stringified JSON strings which are common in BlockNote editor data.
   */
  private processContent(content: any, mediaIds: string[]): any {
    if (!content) return content;

    // Handle stringified content top-level
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        const updated = this.processContent(parsed, mediaIds);
        return JSON.stringify(updated);
      } catch (e) {
        return content;
      }
    }

    if (Array.isArray(content)) {
      return content
        .map(item => this.processItem(item, mediaIds))
        .filter(item => item !== null);
    }

    if (typeof content === 'object') {
      return this.processItem(content, mediaIds);
    }

    return content;
  }

  private processItem(item: any, mediaIds: string[]): any {
    if (!item || typeof item !== 'object') return item;

    // Check if this is a media block that needs to be removed
    // We check props.id (new standard) OR the URL (fallback/extra safety)
    if (item.props && item.props.id && mediaIds.includes(item.props.id)) {
      return null; // Removing block
    }

    // Recursively check 'content' field if it exists (might be a string or array)
    if (item.content) {
      item.content = this.processContent(item.content, mediaIds);
    }

    // Recursively check children if any
    if (item.children && Array.isArray(item.children)) {
      item.children = item.children
        .map(child => this.processItem(child, mediaIds))
        .filter(child => child !== null);
    }

    return item;
  }
}
