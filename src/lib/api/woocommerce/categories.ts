import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { prismaCategoryToWoo } from "./db-mapper";
import type { ProductCategory } from "@/types/woocommerce";
import { decodeHtmlEntities } from "@/lib/utils/html";

type GetCategoriesParams = {
  perPage?: number;
  page?: number;
  parent?: number; // 0 for top-level only
  hideEmpty?: boolean;
  search?: string;
  slug?: string;
};

export async function getCategories(
  params: GetCategoriesParams = {}
): Promise<ProductCategory[]> {
  const fetcher = unstable_cache(
    async () => {
      const where: Prisma.CategoryWhereInput = {};

      if (params.parent !== undefined) {
        where.parentId = params.parent === 0 ? null : params.parent;
      }
      if (params.search) {
        where.name = { contains: params.search };
      }
      if (params.slug) {
        where.slug = params.slug;
      }
      // If hideEmpty is true, we should only fetch categories with products.
      if (params.hideEmpty) {
        where.products = { some: {} };
      }

      const categories = await getPrisma().category.findMany({
        where,
        take: params.perPage || 100,
        skip: params.page && params.perPage ? (params.page - 1) * params.perPage : 0,
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { name: 'asc' },
      });

      return categories.map(prismaCategoryToWoo);
    },
    [JSON.stringify(params), "getCategories"],
    { revalidate: 3600, tags: ["categories"] }
  );

  const categories = await fetcher();

  return categories.map((category) => ({
    ...category,
    name: decodeHtmlEntities(category.name),
    description: decodeHtmlEntities(category.description),
  }));
}

/** Ambil SEMUA kategori (paginated di belakang layar) — dipakai form admin produk. */
export async function getAllCategories(): Promise<ProductCategory[]> {
  const all: ProductCategory[] = [];
  let page = 1;

  while (true) {
    const batch = await getCategories({ perPage: 100, page });
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return all;
}
