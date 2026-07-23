import { revalidateTag } from "next/cache";
import { wooFetch, wooFetchWithMeta } from "./client";
import type {
  Product,
  GetProductsParams,
  ProductVariation,
  ProductAttributeTaxonomy,
  ProductAttributeTerm,
  ProductInput,
} from "@/types/woocommerce";
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
  if (params.attribute) query.set("attribute", params.attribute);
  if (params.attributeTerm) query.set("attribute_term", String(params.attributeTerm));

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

/** Dipakai admin panel — cari produk by ID WooCommerce (dari link daftar produk). */
export async function getProductById(id: number): Promise<Product | null> {
  try {
    const product = await wooFetch<Product>(`/products/${id}`, {
      next: { revalidate: 600, tags: [`product-id-${id}`] },
    });
    return decodeProduct(product);
  } catch {
    return null;
  }
}

/** Detail per varian (harga/stok/SKU spesifik) untuk produk `type: "variable"`. */
export async function getProductVariations(productId: number): Promise<ProductVariation[]> {
  return wooFetch<ProductVariation[]>(`/products/${productId}/variations?per_page=100`, {
    next: { revalidate: 300, tags: [`product-${productId}-variations`] },
  });
}

/** Daftar taxonomy atribut global (mis. "Kapasitas Storage" -> slug pa_kapasitas-storage). */
export async function getProductAttributes(): Promise<ProductAttributeTaxonomy[]> {
  return wooFetch<ProductAttributeTaxonomy[]>(`/products/attributes`, {
    next: { revalidate: 3600, tags: ["product-attributes"] },
  });
}

/** Term (pilihan nilai) untuk satu taxonomy atribut, mis. "1TB+", "2TB+" untuk Kapasitas Storage. */
export async function getProductAttributeTerms(attributeId: number): Promise<ProductAttributeTerm[]> {
  return wooFetch<ProductAttributeTerm[]>(`/products/attributes/${attributeId}/terms?per_page=100`, {
    next: { revalidate: 3600, tags: [`attribute-${attributeId}-terms`] },
  });
}

/** Buat produk baru (dipakai admin panel). Revalidate cache produk setelah sukses. */
export async function createProduct(input: ProductInput): Promise<Product> {
  const product = await wooFetch<Product>(`/products`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  revalidateTag("products", { expire: 0 });
  if (product.categories?.length) {
    for (const category of product.categories) revalidateTag(`category-${category.id}`, { expire: 0 });
  }

  return decodeProduct(product);
}

/** Update produk WooCommerce (dipakai admin panel). Revalidate cache produk setelah sukses. */
export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const product = await wooFetch<Product>(`/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  revalidateTag("products", { expire: 0 });
  revalidateTag(`product-${product.slug}`, { expire: 0 });
  if (product.categories?.length) {
    for (const category of product.categories) revalidateTag(`category-${category.id}`, { expire: 0 });
  }

  return decodeProduct(product);
}
