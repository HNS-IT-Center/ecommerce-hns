const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const cats = await prisma.category.findMany({
    select: { slug: true, path: true }
  });
  console.log("ALL CATS:");
  for (const c of cats) {
    if (c.path.toLowerCase().includes('aksesoris') || c.path.toLowerCase().includes('printer') || c.path.toLowerCase().includes('kabel') || c.path.toLowerCase().includes('furn') || c.path.toLowerCase().includes('power') || c.path.toLowerCase().includes('card')) {
      console.log(c.slug, " | ", c.path);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
