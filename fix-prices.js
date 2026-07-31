const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVariablePrices() {
  console.log("Fetching variable products...");
  const variables = await prisma.product.findMany({
    where: { type: 'VARIABLE' },
    include: { variations: true }
  });
  
  let updatedCount = 0;
  for (const p of variables) {
    if (p.variations && p.variations.length > 0) {
      const minRegular = Math.min(...p.variations.map(v => v.regularPrice ? Number(v.regularPrice) : Infinity).filter(v => v !== Infinity));
      const minSale = Math.min(...p.variations.map(v => v.salePrice ? Number(v.salePrice) : Infinity).filter(v => v !== Infinity));
      
      const regularPrice = minRegular !== Infinity ? minRegular : null;
      const salePrice = minSale !== Infinity ? minSale : null;
      
      if (Number(p.regularPrice) !== regularPrice || Number(p.salePrice) !== salePrice) {
        await prisma.product.update({
          where: { id: p.id },
          data: { regularPrice, salePrice }
        });
        updatedCount++;
      }
    }
  }
  console.log(`Updated ${updatedCount} variable products with minimum variation prices.`);
}

fixVariablePrices().catch(console.error).finally(() => prisma.$disconnect());
