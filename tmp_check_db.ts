import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lastSub = await prisma.studentSubscription.findFirst({
    orderBy: { created_at: 'desc' },
  });
  console.log(JSON.stringify(lastSub, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
