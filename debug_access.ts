import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lesson = await prisma.lesson.findFirst({
    orderBy: { created_at: 'desc' },
  });

  if (!lesson) {
    console.log('No lessons found');
    return;
  }

  console.log('Latest Lesson Content Structure:');
  console.log(JSON.stringify(lesson.content, null, 2));
  
  const accesses = await prisma.materialAccess.findMany({
    where: { lesson_id: lesson.id },
    include: { student: true }
  });
  console.log('\nAccesses for this lesson:');
  console.log(accesses.map(a => ({ student: a.student.email, type: a.material_type, mat_id: a.material_id })));

  const allAccesses = await prisma.materialAccess.findMany({
    take: 10,
    orderBy: { created_at: 'desc' },
  });
  console.log('\nLatest 10 material accesses:');
  console.log(allAccesses.map(a => ({ student_id: a.student_id, type: a.material_type, mat_id: a.material_id })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
