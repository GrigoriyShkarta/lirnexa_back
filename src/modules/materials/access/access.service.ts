import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { MaterialType } from '@prisma/client';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async grant_access(granterId: string, dto: GrantAccessDto) {
    const { student_ids, material_ids, material_type, full_access, accessible_blocks } = dto;

    // Verify all students exist
    const students = await this.prisma.user.findMany({
      where: { id: { in: student_ids } },
      select: { id: true },
    });
    if (students.length !== student_ids.length) {
      const foundIds = students.map(s => s.id);
      const missingIds = student_ids.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`Students with IDs ${missingIds.join(', ')} not found`);
    }

    // Verify all materials exist
    for (const id of material_ids) {
      await this.verify_material_exists(id, material_type);
    }

    // Prepare matrix of operations
    const operations: any[] = [];
    const allGrantRequests: { student_id: string; material_id: string; material_type: MaterialType }[] = [];

    // 1. Add explicitly requested materials
    for (const student_id of student_ids) {
      for (const material_id of material_ids) {
        allGrantRequests.push({ student_id, material_id, material_type });
      }
    }

    // 2. If granting access to lessons, find all materials inside them (if enabled for that lesson)
    if (material_type === MaterialType.lesson) {
      const lessons = await this.prisma.lesson.findMany({
        where: { id: { in: material_ids } },
        select: { id: true, content: true, add_files_to_materials: true }
      });

      for (const lesson of lessons) {
        // Only grant access to internal materials if the lesson flag is true
        if (lesson.add_files_to_materials !== false) {
          // If partial access, only extract from allowed blocks
          const blocksToParse = full_access === false ? accessible_blocks : undefined;
          const internalMaterials = this.extractMaterialsFromContent(lesson.content, blocksToParse);
          
          for (const student_id of student_ids) {
            for (const mat of internalMaterials) {
              const exists = allGrantRequests.some(r => 
                r.student_id === student_id && 
                r.material_id === mat.id && 
                r.material_type === mat.type
              );
              if (!exists) {
                allGrantRequests.push({ student_id, material_id: mat.id, material_type: mat.type });
              }
            }
          }
        }
      }
    }

    // 3. Create upsert operations for all materials
    for (const req of allGrantRequests) {
      console.log(`Granting ${req.material_type} access to student ${req.student_id} for material ${req.material_id}`);
      operations.push(
        this.prisma.materialAccess.upsert({
          where: {
            student_id_material_type_material_id: {
              student_id: req.student_id,
              material_type: req.material_type,
              material_id: req.material_id,
            },
          },
          update: {
            full_access: req.material_type === material_type ? (full_access ?? true) : true,
            accessible_blocks: req.material_type === material_type ? (accessible_blocks ?? []) : [],
            granted_by_id: granterId,
          },
          create: {
            student_id: req.student_id,
            material_type: req.material_type,
            material_id: req.material_id,
            full_access: req.material_type === material_type ? (full_access ?? true) : true,
            accessible_blocks: req.material_type === material_type ? (accessible_blocks ?? []) : [],
            granted_by_id: granterId,
            ...(req.material_type === MaterialType.lesson ? { lesson_id: req.material_id } : {}),
            ...(req.material_type === MaterialType.photo ? { photo_id: req.material_id } : {}),
            ...(req.material_type === MaterialType.video ? { video_id: req.material_id } : {}),
            ...(req.material_type === MaterialType.audio ? { audio_id: req.material_id } : {}),
            ...(req.material_type === MaterialType.file ? { file_id: req.material_id } : {}),
            ...(req.material_type === MaterialType.test ? { test_id: req.material_id } : {}),
          },
        }),
      );
    }

    // Perform bulk upsert in a transaction
    return this.prisma.$transaction(operations);
  }

  async revoke_access(student_ids: string[], material_ids: string[], material_type: MaterialType) {
    return this.prisma.materialAccess.deleteMany({
      where: {
        student_id: { in: student_ids },
        material_type,
        material_id: { in: material_ids },
      },
    });
  }

  async get_student_access(student_id: string) {
    return this.prisma.materialAccess.findMany({
      where: { student_id },
      include: {
        lesson: true,
        photo: true,
        video: true,
        audio: true,
        file: true,
        test: true,
      },
    });
  }

  async sync_lesson_materials_access(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, content: true, add_files_to_materials: true }
    });

    if (!lesson || lesson.add_files_to_materials === false) return;

    // Find all students who have ANY access to this lesson
    const accesses = await this.prisma.materialAccess.findMany({
      where: { lesson_id: lessonId },
      select: { student_id: true, full_access: true, accessible_blocks: true, granted_by_id: true }
    });

    if (accesses.length === 0) return;

    for (const access of accesses) {
      const blocksToParse = access.full_access === false ? access.accessible_blocks : undefined;
      const internalMaterials = this.extractMaterialsFromContent(lesson.content, blocksToParse);
      
      if (internalMaterials.length === 0) continue;

      const operations = internalMaterials.map(mat => {
        return this.prisma.materialAccess.upsert({
          where: {
            student_id_material_type_material_id: {
              student_id: access.student_id,
              material_type: mat.type,
              material_id: mat.id,
            },
          },
          update: {
             granted_by_id: access.granted_by_id, // Keep the same granter
          },
          create: {
            student_id: access.student_id,
            material_type: mat.type,
            material_id: mat.id,
            full_access: true,
            accessible_blocks: [],
            granted_by_id: access.granted_by_id,
            ...(mat.type === MaterialType.photo ? { photo_id: mat.id } : {}),
            ...(mat.type === MaterialType.video ? { video_id: mat.id } : {}),
            ...(mat.type === MaterialType.audio ? { audio_id: mat.id } : {}),
            ...(mat.type === MaterialType.file ? { file_id: mat.id } : {}),
            ...(mat.type === MaterialType.test ? { test_id: mat.id } : {}),
          },
        });
      });

      await this.prisma.$transaction(operations);
    }
  }

  private async verify_material_exists(id: string, type: MaterialType) {
    let exists = false;
    switch (type) {
      case MaterialType.lesson:
        exists = !!(await this.prisma.lesson.findUnique({ where: { id } }));
        break;
      case MaterialType.photo:
        exists = !!(await this.prisma.photo.findUnique({ where: { id } }));
        break;
      case MaterialType.video:
        exists = !!(await this.prisma.video.findUnique({ where: { id } }));
        break;
      case MaterialType.audio:
        exists = !!(await this.prisma.audio.findUnique({ where: { id } }));
        break;
      case MaterialType.file:
        exists = !!(await this.prisma.materialFile.findUnique({ where: { id } }));
        break;
      case MaterialType.test:
        exists = !!(await this.prisma.test.findUnique({ where: { id } }));
        break;
      default:
        throw new BadRequestException(`Unknown material type: ${type}`);
    }

    if (!exists) {
      throw new NotFoundException(`${type} with ID ${id} not found`);
    }
  }

  private extractMaterialsFromContent(content: any, allowedBlockIds?: string[]): { id: string; type: MaterialType }[] {
    const materials: { id: string; type: MaterialType }[] = [];
    if (!content) return materials;

    // Ensure content is an array
    const allBlocks = Array.isArray(content) ? content : (typeof content === 'object' ? [content] : []);
    
    // If partial access, filter top-level blocks
    const filteredBlocks = allowedBlockIds 
      ? allBlocks.filter((block: any) => block && allowedBlockIds.includes(block.id)) 
      : allBlocks;

    const processItem = (item: any) => {
      if (!item) return;

      // New: If the item itself is a string that looks like JSON, try to parse it
      if (typeof item === 'string' && (item.startsWith('[') || item.startsWith('{'))) {
        try {
          const parsed = JSON.parse(item);
          processItem(parsed);
          return;
        } catch (e) {
          // Not valid JSON, continue
        }
      }

      if (typeof item !== 'object') return;

      if (Array.isArray(item)) {
        item.forEach(processItem);
        return;
      }

      // Check for material ID in props
      if (item.type && item.props) {
        const props = item.props;
        const mId = props.id || props.photo_id || props.video_id || props.audio_id || props.file_id || props.test_id;
        
        if (mId) {
          if (item.type === 'image' || item.type === 'photo') {
            materials.push({ id: mId, type: MaterialType.photo });
          } else if (item.type === 'video') {
            materials.push({ id: mId, type: MaterialType.video });
          } else if (item.type === 'audio') {
            materials.push({ id: mId, type: MaterialType.audio });
          } else if (item.type === 'file' || item.type === 'attachment') {
            materials.push({ id: mId, type: MaterialType.file });
          } else if (item.type === 'test' || item.type === 'quiz') {
            materials.push({ id: mId, type: MaterialType.test });
          }
        }
      }

      // Recursively check all properties
      for (const key in item) {
        if (item[key] !== null && (typeof item[key] === 'object' || typeof item[key] === 'string')) {
          // Avoid infinite recursion by not following common circular keys
          if (key !== 'parent') {
             processItem(item[key]);
          }
        }
      }
    };

    filteredBlocks.forEach(processItem);
    console.log(`Extracted ${materials.length} internal materials from lesson content`);
    return materials;
  }
}
