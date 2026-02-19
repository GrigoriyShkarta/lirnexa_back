import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.audio.count();
  console.log('Total audios in DB:', count);
  const all = await prisma.audio.findMany();
  console.log('Length of all array:', all.length);
  process.exit(0);
}

main();
