import { wooFetch } from "./client";
import type { Product, GetProductsParams } from "@/types/woocommerce";

export async function getProducts(
  params: GetProductsParams = {}
): Promise<Product[]> {
  const query = new URLSearchParams();
  
  if (params.category) query.set("category", String(params.category));
  if (params.perPage) query.set("per_page", String(params.perPage));
  if (params.page) query.set("page", String(params.page));
  if (params.orderby) query.set("orderby", params.orderby);
  if (params.order) query.set("order", params.order);
  if (params.search) query.set("search", params.search);
  if (params.onSale) query.set("on_sale", "true");
  if (params.featured) query.set("featured", "true");
  if (params.minPrice) query.set("min_price", String(params.minPrice));
  if (params.maxPrice) query.set("max_price", String(params.maxPrice));
  if (params.include && params.include.length > 0) {
    query.set("include", params.include.join(","));
  }
  if (params.exclude && params.exclude.length > 0) {
    query.set("exclude", params.exclude.join(","));
  }
  
  query.set("status", "publish");

  return wooFetch<Product[]>(`/products?${query.toString()}`, {
    next: {
      revalidate: 300,
      tags: [
        "products", 
        params.category ? `category-${params.category}` : "all-products"
      ],
    },
  });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await wooFetch<Product[]>(`/products?slug=${slug}`, {
    next: { revalidate: 600, tags: [`product-${slug}`] },
  });
  return products[0] ?? null;
}
