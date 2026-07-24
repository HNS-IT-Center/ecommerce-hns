import fs from 'fs';
import csv from 'csv-parser';
import { PrismaClient, ProductType, ProductStatus, StockStatus, CatalogVisibility } from '@prisma/client';

// Use the local project's Prisma client instead of hardcoding one so that the MariaDB driver is used
import { getPrisma } from '../src/lib/prisma/client';

const prisma = getPrisma();

const CSV_FILE = 'wc-product-export-22-7-2026-1784710435651.csv';

// Utilities
const parsePrice = (val: string) => {
  if (!val) return null;
  const cleaned = val.replace(/Rp/g, '').replace(/\./g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
};

const importData = async () => {
  console.log('Starting CSV import...');
  const products: any[] = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => products.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Parsed ${products.length} products. Starting DB inserts...`);

  for (const row of products) {
    try {
      const rawId = row['ID'] || row['\uFEFFID'] || row['\ufeffID'] || Object.values(row)[0];
      const wooId = parseInt(rawId as string, 10);
      if (isNaN(wooId)) continue;

      // Extract basic fields
      const sku = row['SKU']?.trim() || null;
      const gtin = row['GTIN/UPC/EAN']?.trim() || null;
      const name = row['Nama']?.trim() || 'Untitled Product';
      const typeStr = row['Tipe']?.toLowerCase();
      let type = ProductType.SIMPLE;
      if (typeStr === 'variable') type = ProductType.VARIABLE;
      else if (typeStr === 'variation') type = ProductType.VARIATION;
      else if (typeStr === 'grouped') type = ProductType.GROUPED;
      else if (typeStr === 'external') type = ProductType.EXTERNAL;

      const isPublished = row['Telah Terbit'] === '1' ? ProductStatus.PUBLISHED
        : row['Telah Terbit'] === '0' ? ProductStatus.DRAFT
          : ProductStatus.PRIVATE;

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + `-${wooId}`;

      const shortDescription = row['Deskripsi Singkat'] || null;
      const description = row['Deskripsi'] || null;

      const regularPrice = parsePrice(row['Harga Normal']);
      const salePrice = parsePrice(row['Harga Obral']);

      const stockQty = row['Stok'] ? parseInt(row['Stok'], 10) : null;
      const stockStatus = row['Stok Tersedia?'] === '1' ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK;

      const brandName = row['Brand']?.trim() || null;
      let brandId = null;
      if (brandName) {
        const brandSlug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const brand = await prisma.brand.upsert({
          where: { slug: brandSlug },
          create: { name: brandName, slug: brandSlug },
          update: {},
        });
        brandId = brand.id;
      }

      // We use upsert so we don't duplicate when running multiple times
      await prisma.product.upsert({
        where: { wooId },
        create: {
          wooId,
          type,
          status: isPublished,
          sku,
          gtin,
          name,
          slug,
          shortDescription,
          description,
          regularPrice,
          salePrice,
          stockQty,
          stockStatus,
          brandId,
          featured: row['Diunggulkan'] === '1',
          visibility: CatalogVisibility.VISIBLE, // fallback
        },
        update: {
          type,
          status: isPublished,
          sku,
          gtin,
          name,
          slug,
          shortDescription,
          description,
          regularPrice,
          salePrice,
          stockQty,
          stockStatus,
          brandId,
          featured: row['Diunggulkan'] === '1',
        }
      });
      console.log(`Upserted Product: ${wooId} - ${name}`);

      // Handle Images (optional, you can expand this if you want images to be stored in DB)
      // Since it's clean data from WooCommerce, we're skipping complex taxonomy for now unless requested.

    } catch (e: any) {
      console.error(`Error importing row ID ${row['ID']}:`, e.message);
    }
  }

  console.log('Import completed.');
};

importData().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => {
  // prisma.$disconnect(); 
  // Custom prisma client from client.ts might not need disconnect, but safe to omit or call process.exit(0)
  process.exit(0);
});
