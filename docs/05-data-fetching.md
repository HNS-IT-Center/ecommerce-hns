# 05 — Data Fetching

> ⚠️ **SEBAGIAN DOKUMEN INI SUDAH TIDAK BERLAKU (per 2026-07-25).**
> Aturan "data produk wajib dari WooCommerce REST API" sudah dicabut. Sumber data
> produk sekarang **Prisma DB (MariaDB Hostinger)**; lihat `CLAUDE.md` §2.2 yang
> menang atas dokumen ini kalau keduanya bertentangan. Bagian yang menyangkut
> WooCommerce dibiarkan sebagai riwayat, belum ditulis ulang.


> Baca dokumen ini sebelum menambah pemanggilan API, caching, atau revalidation.
> Aturan pertama: **semua data eksternal wajib lewat `lib/api/`. Tidak ada fetch mentah di komponen.**

---

## 1. Sumber Data

| Sumber | Tujuan | Auth |
|---|---|---|
| **WooCommerce REST API** | Produk, kategori, brand, order, customer | Basic Auth (consumer key/secret) |
| **WordPress REST API** | Blog / artikel, halaman statis | Publik (baca), Basic Auth (tulis) |
| **Payment Gateway** (Midtrans/Xendit) | Buat transaksi, cek status | API key server-side |
| **Search Engine** (Meilisearch/Algolia — opsional) | Search cepat | API key |
| **WhatsApp** | Buka chat CS, kirim pre-filled pesan | Public URL (wa.me), tidak ada API call |

---

## 2. Struktur `lib/api/woocommerce/`

```
lib/api/woocommerce/
├── client.ts          ← Base fetcher dengan auth + error handling
├── products.ts        ← getProducts, getProductBySlug, getProductsByCategory
├── categories.ts      ← getCategories, getCategoryBySlug
├── brands.ts          ← getBrands, getProductsByBrand
├── orders.ts          ← createOrder, getOrder, getUserOrders
├── customers.ts       ← createCustomer, updateCustomer
└── types.ts           ← Type WooCommerce (dari types/woocommerce.ts)
```

Setiap file **hanya** menangani 1 domain. Jangan campur.

---

## 3. Base Client

Contoh `client.ts` (ditulis lengkap saat implementasi):

```typescript
import { env } from "@/config/env";

type FetchOptions = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
};

const auth = Buffer.from(
  `${env.WOOCOMMERCE_CONSUMER_KEY}:${env.WOOCOMMERCE_CONSUMER_SECRET}`,
).toString("base64");

export async function wooFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const url = `${env.WOOCOMMERCE_URL}/wp-json/wc/v3${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new WooApiError({
      status: res.status,
      statusText: res.statusText,
      path,
    });
  }

  return res.json() as Promise<T>;
}

export class WooApiError extends Error {
  status: number;
  statusText: string;
  path: string;
  constructor(args: { status: number; statusText: string; path: string }) {
    super(`WooCommerce ${args.status} on ${args.path}: ${args.statusText}`);
    Object.assign(this, args);
  }
}
```

### Aturan Base Client
- Base URL & credential **hanya** dari `env` — tidak ada hardcode.
- Semua error dibungkus `WooApiError` agar mudah di-catch & log.
- Timeout via `AbortController` (default 10 detik).
- Retry hanya untuk error 5xx / network — tidak retry 4xx.

---

## 4. Domain Function

Setiap endpoint domain mengekspor fungsi bertipe eksplisit:

```typescript
// lib/api/woocommerce/products.ts
import { wooFetch } from "./client";
import type { Product, GetProductsParams } from "@/types/woocommerce";

export async function getProducts(
  params: GetProductsParams = {},
): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", String(params.category));
  if (params.perPage) query.set("per_page", String(params.perPage));
  if (params.page) query.set("page", String(params.page));
  if (params.orderby) query.set("orderby", params.orderby);
  if (params.order) query.set("order", params.order);
  if (params.search) query.set("search", params.search);
  query.set("status", "publish");

  return wooFetch<Product[]>(`/products?${query.toString()}`, {
    next: {
      revalidate: 300,
      tags: ["products", params.category ? `category-${params.category}` : "all-products"],
    },
  });
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await wooFetch<Product[]>(`/products?slug=${slug}`, {
    next: { revalidate: 600, tags: [`product-${slug}`] },
  });
  return products[0] ?? null;
}
```

### Aturan Domain Function
- Nama fungsi menggambarkan intent, bukan endpoint (`getProducts`, bukan `fetchProductsEndpoint`).
- Return type eksplisit.
- Semua parameter dibungkus 1 objek `params` (bukan positional).
- Selalu set `revalidate` & `tags` untuk caching.

---

## 5. Caching Strategy

### 5.1 Prinsip
- Katalog & produk **wajib** di-cache (SEO + performa).
- Data yang berubah cepat (stok, cart, checkout) **wajib** dynamic (no cache).
- Cache di-invalidate lewat **webhook WooCommerce** → Route Handler `/api/revalidate`.

### 5.2 Tabel Cache Policy

| Endpoint | Revalidate | Tag | Strategi Invalidation |
|---|---|---|---|
| `/products` (list) | 300s (5 menit) | `products`, `category-<slug>` | Webhook product update/create |
| `/products?slug=X` (detail) | 600s (10 menit) | `product-<slug>` | Webhook product update |
| `/products/categories` | 3600s (1 jam) | `categories` | Manual / webhook category update |
| `/products/brands` (custom) | 3600s | `brands` | Manual |
| Blog post | 3600s | `blog`, `post-<slug>` | Webhook post update |
| Order (create/read) | No cache | — | — |
| Customer data | No cache | — | — |
| Cart (client-side) | No cache | — | — |

### 5.3 Webhook Revalidation

WooCommerce dikonfigurasi mengirim webhook ke Next.js saat produk berubah:

```
WooCommerce Settings → Advanced → Webhooks
- Topic: Product updated → URL: https://yoursite.com/api/revalidate
- Topic: Product created → URL: https://yoursite.com/api/revalidate
- Topic: Product deleted → URL: https://yoursite.com/api/revalidate
```

Route handler:

```typescript
// src/app/api/revalidate/route.ts
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const slug = body?.slug as string | undefined;

  revalidateTag("products");
  if (slug) revalidateTag(`product-${slug}`);

  return NextResponse.json({ revalidated: true, slug });
}
```

Konfigurasi WooCommerce: tambahkan header `x-webhook-secret` dengan nilai `REVALIDATE_SECRET`.

---

## 6. Pemakaian di Komponen

### 6.1 Server Component
```tsx
// src/app/(shop)/product/[slug]/page.tsx
import { getProductBySlug } from "@/lib/api/woocommerce/products";
import { notFound } from "next/navigation";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  return <ProductDetail product={product} />;
}

// Generate metadata untuk SEO
export async function generateMetadata({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.short_description,
    openGraph: { images: [product.images[0]?.src] },
  };
}
```

### 6.2 Client Component (TanStack Query)

Untuk fetch di client (search live, infinite scroll):

```tsx
// features/search/hooks/useLiveSearch.ts
"use client";
import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/features/search/services/searchService";

export function useLiveSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => searchProducts(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
```

**Penting:** `searchProducts` **tidak** langsung memanggil WooCommerce dari browser (kredensial akan bocor). Panggil lewat Route Handler internal:

```typescript
// features/search/services/searchService.ts
export async function searchProducts(q: string) {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}
```

```typescript
// src/app/api/search/route.ts
import { getProducts } from "@/lib/api/woocommerce/products";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const products = await getProducts({ search: q, perPage: 10 });
  return Response.json(products);
}
```

---

## 7. Loading & Error Handling

### 7.1 Route Level
Setiap route punya `loading.tsx` & `error.tsx`:

```tsx
// src/app/(shop)/shop/loading.tsx
export default function ShopLoading() {
  return <ProductGridSkeleton count={12} />;
}

// src/app/(shop)/shop/error.tsx
"use client";
export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="Gagal memuat produk"
      description="Mohon coba lagi. Jika masalah berlanjut, hubungi CS via WhatsApp."
      onRetry={reset}
    />
  );
}
```

### 7.2 Component Level
Untuk client component dengan TanStack Query:

```tsx
const { data, isLoading, isError, refetch } = useLiveSearch(query);
if (isLoading) return <Skeleton />;
if (isError) return <ErrorState onRetry={() => refetch()} />;
if (!data?.length) return <EmptyState />;
return <Results items={data} />;
```

---

## 8. Type Safety

### 8.1 Type WooCommerce
Simpan di `src/types/woocommerce.ts`. Contoh:

```typescript
export type Product = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type: "simple" | "variable" | "grouped" | "external";
  status: "publish" | "draft" | "pending";
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  categories: Array<{ id: number; name: string; slug: string }>;
  images: Array<{ id: number; src: string; alt: string }>;
  attributes: Array<ProductAttribute>;
  variations: number[];
  meta_data: Array<{ id: number; key: string; value: unknown }>;
};

export type ProductAttribute = {
  id: number;
  name: string;
  slug: string;
  options: string[];
  variation: boolean;
};

export type GetProductsParams = {
  category?: string | number;
  brand?: string;
  perPage?: number;
  page?: number;
  orderby?: "date" | "id" | "title" | "slug" | "price" | "popularity" | "rating";
  order?: "asc" | "desc";
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  featured?: boolean;
};
```

### 8.2 Runtime Validation (Optional tapi Direkomendasikan)
Untuk data eksternal, gunakan Zod untuk parse & validate:

```typescript
import { z } from "zod";

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  price: z.string(),
  // ...
});

const products = z.array(ProductSchema).parse(rawResponse);
```

Manfaat: kalau WooCommerce response berubah, error jelas di boundary, bukan runtime error random di UI.

---

## 9. Pagination

Gunakan pattern:

```typescript
export async function getProductsPaginated(params: GetProductsParams) {
  const query = new URLSearchParams();
  query.set("per_page", String(params.perPage ?? 20));
  query.set("page", String(params.page ?? 1));
  // ...

  const res = await fetch(`${env.WOOCOMMERCE_URL}/wp-json/wc/v3/products?${query}`, {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 300 },
  });

  return {
    items: (await res.json()) as Product[],
    total: Number(res.headers.get("x-wp-total") ?? 0),
    totalPages: Number(res.headers.get("x-wp-totalpages") ?? 0),
  };
}
```

WooCommerce menaruh total di header `X-WP-Total` dan `X-WP-TotalPages`.

---

## 10. Search: WooCommerce vs Search Engine Terpisah

### 10.1 Fase 1 — WooCommerce Search
Cukup untuk MVP: `/products?search=xxx`. Kekurangan: lambat untuk katalog besar, tidak ada fuzzy match, tidak ada faceted search.

### 10.2 Fase 2 — Meilisearch / Algolia
Sync produk WooCommerce → index Meilisearch (via webhook + cron). Search lewat client langsung ke Meilisearch (search-only key, aman di browser).

Detail implementasi Meilisearch akan didokumentasikan terpisah saat fase ini dimulai.

---

## 11. Rate Limiting & Retry

- WooCommerce tidak punya rate limit built-in yang kuat, tapi hosting bisa membatasi.
- Untuk request bulk (misal sync search index), gunakan concurrency limit (misal 3–5 request paralel maks).
- Retry hanya untuk error 500, 502, 503, 504, dan network error. Maks 3 kali dengan exponential backoff.

---

## 12. Yang TIDAK Boleh Dilakukan

- ❌ Fetch WooCommerce langsung dari komponen (`fetch("https://.../wp-json/...")` di dalam Client Component).
- ❌ Expose consumer key/secret via `NEXT_PUBLIC_*`.
- ❌ Cache order & customer data (privacy + data staleness).
- ❌ Fetch di dalam loop tanpa `Promise.all` (waterfall).
- ❌ Skip error handling ("nanti aja" — jangan).
- ❌ Menyimpan data produk permanen ke database Next.js (langgar aturan di 01-business-context.md).
