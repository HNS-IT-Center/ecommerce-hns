import { revalidateTag, unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
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

function buildPrismaWhere(params: GetProductsParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    status: 'PUBLISHED',
    parentId: null, // Only fetch parent products by default for listing
  };

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

/** Buat produk baru (dipakai admin panel). Revalidate cache produk setelah sukses. */
export async function createProduct(input: ProductInput): Promise<Product> {
  // Not fully implemented for DB write yet, requires more complex mapping
  // We'll throw or mock for now as requested by "ubah methodenya penarikan produk"
  throw new Error("createProduct via DB is not fully implemented yet.");
}

/** Update produk WooCommerce (dipakai admin panel). Revalidate cache produk setelah sukses. */
export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  throw new Error("updateProduct via DB is not fully implemented yet.");
}
