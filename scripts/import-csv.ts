import { PrismaClient, ProductType, ProductStatus, StockStatus, CatalogVisibility } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });
const csvDir = path.join(process.cwd(), 'csv');

function readCsv(filename: string) {
  const filePath = path.join(csvDir, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`File ${filename} not found, skipping...`);
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    cast: true
  });
}

// Helper to chunk arrays
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

async function main() {
  console.log('Starting CSV Import (Optimized Batch Mode)...');

  console.log('Clearing old data...');
  await prisma.productCategory.deleteMany();
  await prisma.productTag.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productAttribute.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.attributeValue.deleteMany();
  await prisma.attribute.deleteMany();
  await prisma.importQuarantine.deleteMany();

  console.log('Importing Brands...');
  const brands = readCsv('brands.csv');
  await prisma.brand.createMany({
    data: brands.map((b: any) => ({
      id: Number(b.id),
      name: String(b.name),
      slug: String(b.slug)
    })),
    skipDuplicates: true
  });

  console.log('Importing Tags...');
  const tags = readCsv('tags.csv');
  await prisma.tag.createMany({
    data: tags.map((t: any) => ({
      id: Number(t.id),
      name: String(t.name),
      slug: String(t.slug)
    })),
    skipDuplicates: true
  });

  console.log('Importing Attributes...');
  const attributes = readCsv('attributes.csv');
  await prisma.attribute.createMany({
    data: attributes.map((a: any) => ({
      id: Number(a.id),
      name: String(a.name)
    })),
    skipDuplicates: true
  });

  console.log('Importing Attribute Values...');
  const attrValuesRaw = readCsv('attribute_values.csv');
  const seenAttrValues = new Set<string>();
  const attrValues = [];
  for (const av of attrValuesRaw as any[]) {
    const key = `${av.attribute_id}-${String(av.value).toLowerCase()}`;
    if (seenAttrValues.has(key)) continue;
    seenAttrValues.add(key);
    attrValues.push({
      id: Number(av.id),
      attributeId: Number(av.attribute_id),
      value: String(av.value)
    });
  }
  const avChunks = chunkArray(attrValues, 1000);
  for (const chunk of avChunks) {
    await prisma.attributeValue.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Importing Categories...');
  const categoriesRaw = readCsv('categories.csv');
  categoriesRaw.sort((a: any, b: any) => Number(a.depth) - Number(b.depth));
  for (const chunk of chunkArray(categoriesRaw, 500)) {
    // Categories need sequential insert if parent relies on it, but wait, createMany might insert out of order?
    // In MariaDB it inserts in order, but we can just loop chunk
    await prisma.category.createMany({
      data: chunk.map((c: any) => ({
        id: Number(c.id),
        name: String(c.name),
        slug: String(c.slug),
        path: String(c.path),
        depth: Number(c.depth),
        parentId: c.parent_id ? Number(c.parent_id) : null
      })),
      skipDuplicates: true
    });
  }

  console.log('Importing Products...');
  const productsRaw = readCsv('products.csv');
  const productData = productsRaw.map((p: any) => ({
    wooId: Number(p.woo_id),
    type: p.type as ProductType,
    status: p.status as ProductStatus,
    visibility: p.visibility as CatalogVisibility,
    sku: p.sku ? String(p.sku) : null,
    gtin: p.gtin ? String(p.gtin) : null,
    name: String(p.name),
    slug: String(p.slug),
    shortDescription: p.short_description ? String(p.short_description) : null,
    description: p.description ? String(p.description) : null,
    regularPrice: p.regular_price ? Number(p.regular_price) : null,
    salePrice: p.sale_price ? Number(p.sale_price) : null,
    stockStatus: p.stock_status ? (p.stock_status as StockStatus) : null,
    stockQty: p.stock_qty ? Number(p.stock_qty) : null,
    backordersAllowed: p.backorders_allowed === true || p.backorders_allowed === 'true',
    soldIndividually: p.sold_individually === true || p.sold_individually === 'true',
    reviewsAllowed: p.reviews_allowed === true || p.reviews_allowed === 'true',
    featured: p.featured === true || p.featured === 'true',
    viewCount: p.view_count ? Number(p.view_count) : 0,
    brandId: p.brand_id ? Number(p.brand_id) : null,
    importNotes: p.import_notes ? String(p.import_notes) : null
  }));

  const productChunks = chunkArray(productData, 1000);
  for (const chunk of productChunks) {
    await prisma.product.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Resolving product variations parent IDs...');
  const allProductsMap = new Map();
  const allProducts = await prisma.product.findMany({ select: { id: true, wooId: true } });
  for (const p of allProducts) {
    allProductsMap.set(p.wooId, p.id);
  }
  
  // Update parents in batch via Promise.all (since there might not be that many variations, or we can just update sequentially)
  let updatePromises = [];
  for (const p of productsRaw as any[]) {
    if (p.parent_woo_id) {
      const parentId = allProductsMap.get(Number(p.parent_woo_id));
      if (parentId) {
        updatePromises.push(
          prisma.product.update({
            where: { wooId: Number(p.woo_id) },
            data: { parentId }
          })
        );
      }
    }
  }
  for (const chunk of chunkArray(updatePromises, 100)) {
    await Promise.all(chunk);
  }

  console.log('Importing Product Categories...');
  const productCategoriesRaw = readCsv('product_categories.csv');
  const pcData = [];
  for (const pc of productCategoriesRaw as any[]) {
    const pid = allProductsMap.get(Number(pc.product_woo_id));
    if (pid && pc.category_id) {
      pcData.push({ productId: pid, categoryId: Number(pc.category_id) });
    }
  }
  for (const chunk of chunkArray(pcData, 1000)) {
    await prisma.productCategory.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Importing Product Tags...');
  const productTagsRaw = readCsv('product_tags.csv');
  const ptData = [];
  for (const pt of productTagsRaw as any[]) {
    const pid = allProductsMap.get(Number(pt.product_woo_id));
    if (pid && pt.tag_id) {
      ptData.push({ productId: pid, tagId: Number(pt.tag_id) });
    }
  }
  for (const chunk of chunkArray(ptData, 1000)) {
    await prisma.productTag.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Importing Product Attributes...');
  const productAttributesRaw = readCsv('product_attributes.csv');
  const paData = [];
  for (const pa of productAttributesRaw as any[]) {
    const pid = allProductsMap.get(Number(pa.product_woo_id));
    if (pid && pa.attribute_id && pa.value_id) {
      paData.push({
        productId: pid,
        attributeId: Number(pa.attribute_id),
        valueId: Number(pa.value_id),
        position: pa.position ? Number(pa.position) : 0
      });
    }
  }
  for (const chunk of chunkArray(paData, 1000)) {
    await prisma.productAttribute.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Importing Product Images...');
  const productImagesRaw = readCsv('product_images.csv');
  const piData = [];
  for (const pi of productImagesRaw as any[]) {
    const pid = allProductsMap.get(Number(pi.product_woo_id));
    if (pid && pi.url) {
      piData.push({
        productId: pid,
        url: String(pi.url),
        position: pi.position ? Number(pi.position) : 0,
        isPrimary: pi.is_primary === true || pi.is_primary === 'true' || pi.is_primary === 1
      });
    }
  }
  for (const chunk of chunkArray(piData, 1000)) {
    await prisma.productImage.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('Importing Import Quarantine...');
  const quarantineRaw = readCsv('import_quarantine.csv');
  const qData = quarantineRaw.map((q: any) => ({
    rowNumber: Number(q.row_number) || 0,
    wooId: q.woo_id ? String(q.woo_id) : null,
    issues: String(q.issue || q.issues || ''),
    rawData: String(q.raw_data || q.raw_name || '')
  }));
  for (const chunk of chunkArray(qData, 1000)) {
    await prisma.importQuarantine.createMany({ data: chunk, skipDuplicates: true });
  }

  console.log('✅ Import Completed Successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
