import { revalidateTag, unstable_cache } from "next/cache";
import { ProductStatus, ProductType, StockStatus, type Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { prismaProductToWoo } from "./db-mapper";
import type {
  Product,
  GetProductsParams,
  ProductVariation,
  ProductAttributeTaxonomy,
  ProductAttributeTerm,
  ProductInput,
} from "@/types/woocommerce";
import { decodeHtmlEntities } from "@/lib/utils/html";

// Base include for Prisma queries to fetch all relations needed by the mapper
const productInclude = {
  brand: true,
  categories: { include: { category: true } },
  tags: { include: { tag: true } },
  images: { orderBy: { position: 'asc' as const } },
  attributes: {
    include: { attribute: true, value: true },
    orderBy: { position: 'asc' as const },
  },
  variations: {
    include: {
      attributes: { include: { attribute: true, value: true } },
    },
  },
};

function decodeProduct(product: Product): Product {
  return {
    ...product,
    name: decodeHtmlEntities(product.name),
    categories: product.categories?.map((c) => ({ ...c, name: decodeHtmlEntities(c.name) })),
    brands: product.brands?.map((b) => ({ ...b, name: decodeHtmlEntities(b.name) })),
  };
}

const STATUS_FROM_PARAM = {
  publish: ProductStatus.PUBLISHED,
  draft: ProductStatus.DRAFT,
  private: ProductStatus.PRIVATE,
} as const;

function buildPrismaWhere(params: GetProductsParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    parentId: null, // Only fetch parent products by default for listing
  };

  // Storefront hanya boleh melihat produk terbit, jadi itu tetap defaultnya.
  // Admin melewatkan "any" supaya draft & private ikut terbawa.
  if (params.status !== "any") {
    where.status = STATUS_FROM_PARAM[params.status ?? "publish"];
  }

  if (params.category) {
    if (typeof params.category === 'string') {
      where.categories = { some: { category: { slug: params.category } } };
    } else {
      where.categories = { some: { categoryId: params.category } };
    }
  }

  if (params.search) {
    where.name = { contains: params.search };
  }

  if (params.onSale) {
    where.salePrice = { not: null };
  }

  if (params.featured) {
    where.featured = true;
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.regularPrice = {};
    if (params.minPrice !== undefined) where.regularPrice.gte = params.minPrice;
    if (params.maxPrice !== undefined) where.regularPrice.lte = params.maxPrice;
  }

  return where;
}

function buildPrismaOrderBy(params: GetProductsParams): Prisma.ProductOrderByWithRelationInput {
  const orderDir = params.order === 'asc' ? 'asc' : 'desc';
  switch (params.orderby) {
    case 'date': return { importedAt: orderDir };
    case 'price': return { regularPrice: orderDir };
    case 'popularity': return { viewCount: orderDir };
    case 'title': return { name: orderDir };
    default: return { id: orderDir };
  }
}

function productsTags(params: GetProductsParams): string[] {
  return ["products", params.category ? `category-${params.category}` : "all-products"];
}

export async function getProducts(
  params: GetProductsParams = {}
): Promise<Product[]> {
  const fetcher = unstable_cache(
    async () => {
      const products = await getPrisma().product.findMany({
        where: buildPrismaWhere(params),
        orderBy: buildPrismaOrderBy(params),
        take: params.perPage || 24,
        skip: params.page && params.perPage ? (params.page - 1) * params.perPage : 0,
        include: productInclude,
      });
      return products.map((p) => prismaProductToWoo(p));
    },
    [JSON.stringify(params), "getProducts"],
    { revalidate: 300, tags: productsTags(params) }
  );

  const products = await fetcher();
  return products.map(decodeProduct);
}

export type GetProductsPaginatedResult = {
  products: Product[];
  total: number;
  totalPages: number;
};

export async function getProductsPaginated(
  params: GetProductsParams = {}
): Promise<GetProductsPaginatedResult> {
  const fetcher = unstable_cache(
    async () => {
      const where = buildPrismaWhere(params);
      const perPage = params.perPage || 24;
      
      const [total, products] = await Promise.all([
        getPrisma().product.count({ where }),
        getPrisma().product.findMany({
          where,
          orderBy: buildPrismaOrderBy(params),
          take: perPage,
          skip: params.page ? (params.page - 1) * perPage : 0,
          include: productInclude,
        }),
      ]);

      const totalPages = Math.ceil(total / perPage);
      return {
        products: products.map((p) => prismaProductToWoo(p)),
        total,
        totalPages,
      };
    },
    [JSON.stringify(params), "getProductsPaginated"],
    { revalidate: 300, tags: productsTags(params) }
  );

  const data = await fetcher();
  return { ...data, products: data.products.map(decodeProduct) };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const fetcher = unstable_cache(
    async () => {
      const product = await getPrisma().product.findFirst({
        where: { slug, status: 'PUBLISHED' },
        include: productInclude,
      });
      return product ? prismaProductToWoo(product) : null;
    },
    [`product-${slug}`],
    { revalidate: 600, tags: [`product-${slug}`] }
  );

  const product = await fetcher();
  return product ? decodeProduct(product) : null;
}

/** Dipakai admin panel — cari produk by ID WooCommerce (dari link daftar produk). */
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const fetcher = unstable_cache(
      async () => {
        const product = await getPrisma().product.findUnique({
          where: { wooId: id },
          include: productInclude,
        });
        return product ? prismaProductToWoo(product) : null;
      },
      [`product-id-${id}`],
      { revalidate: 600, tags: [`product-id-${id}`] }
    );
    const product = await fetcher();
    return product ? decodeProduct(product) : null;
  } catch {
    return null;
  }
}

/** Detail per varian (harga/stok/SKU spesifik) untuk produk `type: "variable"`. */
export async function getProductVariations(productId: number): Promise<ProductVariation[]> {
  const fetcher = unstable_cache(
    async () => {
      // Find the parent's internal ID
      const parent = await getPrisma().product.findUnique({ where: { wooId: productId }});
      if (!parent) return [];

      const variations = await getPrisma().product.findMany({
        where: { parentId: parent.id },
        include: productInclude,
      });

      return variations.map((v) => {
        const woo = prismaProductToWoo(v);
        // Map WooProduct to ProductVariation format
        return {
          id: woo.id,
          sku: woo.sku,
          price: woo.price,
          regular_price: woo.regular_price,
          sale_price: woo.sale_price,
          on_sale: woo.on_sale,
          stock_status: woo.stock_status,
          stock_quantity: woo.stock_quantity,
          attributes: woo.attributes.map(a => ({
            id: a.id,
            name: a.name,
            option: a.options[0] || "",
          })),
          image: woo.images?.[0] || null,
        };
      });
    },
    [`product-${productId}-variations`],
    { revalidate: 300, tags: [`product-${productId}-variations`] }
  );
  return fetcher();
}

/** Daftar taxonomy atribut global (mis. "Kapasitas Storage" -> slug pa_kapasitas-storage). */
export async function getProductAttributes(): Promise<ProductAttributeTaxonomy[]> {
  const fetcher = unstable_cache(
    async () => {
      const attributes = await getPrisma().attribute.findMany();
      return attributes.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.name.toLowerCase().replace(/\s+/g, '-'),
      }));
    },
    ["product-attributes"],
    { revalidate: 3600, tags: ["product-attributes"] }
  );
  return fetcher();
}

/** Term (pilihan nilai) untuk satu taxonomy atribut, mis. "1TB+", "2TB+" untuk Kapasitas Storage. */
export async function getProductAttributeTerms(attributeId: number): Promise<ProductAttributeTerm[]> {
  const fetcher = unstable_cache(
    async () => {
      const terms = await getPrisma().attributeValue.findMany({
        where: { attributeId },
      });
      return terms.map(t => ({
        id: t.id,
        name: t.value,
        count: 0, // In full implementation, we'd count products with this term
      }));
    },
    [`attribute-${attributeId}-terms`],
    { revalidate: 3600, tags: [`attribute-${attributeId}-terms`] }
  );
  return fetcher();
}

function slugify(name: string, wooId: number): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + `-${wooId}`
  );
}

async function nextWooId(): Promise<number> {
  const result = await getPrisma().product.aggregate({ _max: { wooId: true } });
  return (result._max.wooId ?? 0) + 1;
}

/** Ganti total kategori/gambar/atribut produk sesuai input (form admin selalu kirim daftar lengkap, bukan patch parsial). */
async function replaceProductRelations(
  tx: Prisma.TransactionClient,
  productId: number,
  input: ProductInput
) {
  await tx.productCategory.deleteMany({ where: { productId } });
  if (input.categories?.length) {
    await tx.productCategory.createMany({
      data: input.categories.map((c) => ({ productId, categoryId: c.id })),
      skipDuplicates: true,
    });
  }

  await tx.productImage.deleteMany({ where: { productId } });
  if (input.images?.length) {
    await tx.productImage.createMany({
      data: input.images.map((img, i) => ({
        productId,
        url: img.url,
        position: i,
        isPrimary: i === 0,
      })),
    });
  }

  // Form admin isi atribut sebagai teks bebas (nama+nilai), bukan pilih dari
  // master data -> upsert ke Attribute/AttributeValue supaya tetap normalisasi.
  await tx.productAttribute.deleteMany({ where: { productId } });
  if (input.attributes?.length) {
    let position = 0;
    for (const attr of input.attributes) {
      const value = attr.options[0];
      if (!attr.name?.trim() || !value?.trim()) continue;

      const attribute = await tx.attribute.upsert({
        where: { name: attr.name.trim() },
        create: { name: attr.name.trim() },
        update: {},
      });
      const attributeValue = await tx.attributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value: value.trim() } },
        create: { attributeId: attribute.id, value: value.trim() },
        update: {},
      });
      await tx.productAttribute.create({
        data: {
          productId,
          attributeId: attribute.id,
          valueId: attributeValue.id,
          position: position++,
        },
      });
    }
  }
}

async function refetchAsWoo(productId: number): Promise<Product> {
  const product = await getPrisma().product.findUniqueOrThrow({
    where: { id: productId },
    include: productInclude,
  });
  return decodeProduct(prismaProductToWoo(product));
}

/** Buat produk baru (dipakai admin panel). Tulis langsung ke Prisma DB (lihat CLAUDE.md §2.2 — WooCommerce tidak lagi dipakai untuk data produk). Gambar tetap diupload lewat WordPress Media API sebelum sampai sini (lihat lib/api/wordpress/media.ts), di sini cuma menyimpan URL-nya. */
export async function createProduct(input: ProductInput): Promise<Product> {
  const prisma = getPrisma();
  const wooId = await nextWooId();
  const slug = slugify(input.name, wooId);
  const stockQty = input.stock_quantity ?? null;

  const created = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        wooId,
        type: ProductType.SIMPLE,
        status: STATUS_FROM_PARAM[input.status ?? "draft"],
        name: input.name,
        slug,
        shortDescription: input.short_description || null,
        description: input.description || null,
        regularPrice: input.regular_price || null,
        salePrice: input.sale_price || null,
        stockQty,
        stockStatus: (stockQty ?? 0) > 0 ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK,
      },
    });
    await replaceProductRelations(tx, product.id, input);
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(created.id);
  revalidateTag("products", "max");
  revalidateTag("all-products", "max");
  return result;
}

/** Update produk (dipakai admin panel). `id` di sini adalah woo_id (konvensi lama, tetap dipakai sebagai identifier publik) - lihat getProductById. */
export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const prisma = getPrisma();
  const existing = await prisma.product.findUnique({ where: { wooId: id } });
  if (!existing) throw new Error(`Produk dengan woo_id=${id} tidak ditemukan`);

  const stockQty = input.stock_quantity;

  const updated = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined && { name: input.name, slug: slugify(input.name, existing.wooId) }),
        ...(input.status !== undefined && {
          status: STATUS_FROM_PARAM[input.status] ?? ProductStatus.DRAFT,
        }),
        ...(input.short_description !== undefined && { shortDescription: input.short_description || null }),
        ...(input.description !== undefined && { description: input.description || null }),
        ...(input.regular_price !== undefined && { regularPrice: input.regular_price || null }),
        ...(input.sale_price !== undefined && { salePrice: input.sale_price || null }),
        ...(stockQty !== undefined && {
          stockQty,
          stockStatus: stockQty > 0 ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK,
        }),
      },
    });

    if (input.categories || input.images || input.attributes) {
      await replaceProductRelations(tx, product.id, input as ProductInput);
    }
    return product;
  }, { timeout: 30000 });

  const result = await refetchAsWoo(updated.id);
  revalidateTag("products", "max");
  revalidateTag("all-products", "max");
  revalidateTag(`product-${existing.slug}`, "max");
  revalidateTag(`product-id-${id}`, "max");
  return result;
}
