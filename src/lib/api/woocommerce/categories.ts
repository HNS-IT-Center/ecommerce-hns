import { wooFetch } from "./client";
import type { ProductCategory } from "@/types/woocommerce";

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

  return wooFetch<ProductCategory[]>(`/products/categories?${query.toString()}`, {
    next: {
      revalidate: 3600,
      tags: ["categories"],
    },
  });
}
