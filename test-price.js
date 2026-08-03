const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.product.findMany({
    orderBy: { regularPrice: 'desc' },
    take: 10,
    select: { name: true, regularPrice: true }
  });
  console.log(p);
}
main().finally(() => prisma.$disconnect());
