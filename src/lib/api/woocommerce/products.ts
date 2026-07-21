import { wooFetch, wooFetchWithMeta } from "./client";
import type { Product, GetProductsParams } from "@/types/woocommerce";
import { decodeHtmlEntities } from "@/lib/utils/html";

// WooCommerce mengembalikan nama produk/kategori/brand dengan HTML entity
// mentah (mis. "FIT &amp; HEALTH") — decode sekali di sini supaya semua
// konsumen (ProductCard, PDP, breadcrumb) tidak perlu mikirin ini sendiri.
function decodeProduct(product: Product): Product {
  return {
    ...product,
    name: decodeHtmlEntities(product.name),
    categories: product.categories?.map((c) => ({ ...c, name: decodeHtmlEntities(c.name) })),
    brands: product.brands?.map((b) => ({ ...b, name: decodeHtmlEntities(b.name) })),
  };
}

function buildProductsQuery(params: GetProductsParams): URLSearchParams {
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
  return query;
}

function productsTags(params: GetProductsParams): string[] {
  return ["products", params.category ? `category-${params.category}` : "all-products"];
}

export async function getProducts(
  params: GetProductsParams = {}
): Promise<Product[]> {
  const query = buildProductsQuery(params);

  const products = await wooFetch<Product[]>(`/products?${query.toString()}`, {
    next: {
      revalidate: 300,
      tags: productsTags(params),
    },
  });

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
  const query = buildProductsQuery(params);

  const { data, meta } = await wooFetchWithMeta<Product[]>(`/products?${query.toString()}`, {
    next: {
      revalidate: 300,
      tags: productsTags(params),
    },
  });

  return { products: data.map(decodeProduct), total: meta.total, totalPages: meta.totalPages };
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await wooFetch<Product[]>(`/products?slug=${slug}`, {
    next: { revalidate: 600, tags: [`product-${slug}`] },
  });
  const product = products[0];
  return product ? decodeProduct(product) : null;
}
