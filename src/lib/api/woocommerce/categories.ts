import { wooFetch } from "./client";
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
  const query = new URLSearchParams();
  
  if (params.perPage) query.set("per_page", String(params.perPage));
  if (params.page) query.set("page", String(params.page));
  if (params.parent !== undefined) query.set("parent", String(params.parent));
  if (params.hideEmpty) query.set("hide_empty", "true");
  if (params.search) query.set("search", params.search);
  if (params.slug) query.set("slug", params.slug);

  const categories = await wooFetch<ProductCategory[]>(`/products/categories?${query.toString()}`, {
    next: {
      revalidate: 3600,
      tags: ["categories"],
    },
  });

  // WooCommerce mengembalikan nama/deskripsi dengan HTML entity mentah
  // (mis. "FIT &amp; HEALTH") — decode sekali di sini supaya semua
  // konsumen (MegaMenu, MobileMenu, ShopSidebar, halaman kategori) beres.
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
