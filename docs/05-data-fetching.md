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

## 10.3 Route Handler AI di panel admin

Tiga endpoint di `/api/admin/*` memanggil Groq memakai API key sistem. Semuanya
memanggil `requireAuth()` lebih dulu — endpoint ini di luar jangkauan proxy
`/admin`, jadi tanpa itu siapa pun yang tahu alamatnya bisa menghabiskan kuota
atas nama kita.

| Endpoint | Guna | Model | `max_tokens` |
|---|---|---|---|
| `POST /api/admin/format-specs` | Merapikan tempelan spesifikasi jadi tabel | `llama-3.3-70b-versatile` ⚠️ | 1500 |
| `POST /api/admin/generate-short-description` | Deskripsi singkat produk | `llama-3.3-70b-versatile` ⚠️ | 300 |
| `POST /api/admin/pc-prebuild-performance` | Analisis performa paket PC Prebuild — badan: `{ presetId, name, slots }`, balasan: `{ performance }` | `openai/gpt-oss-120b` (`reasoning_effort: low`) | 4000 |

### `pc-prebuild-performance`: angkanya berjangkar (28 Agustus 2026)

Bentuk badan dan balasan **tidak berubah** — yang berubah isi promptnya. Sampai
28 Agustus 2026 angka FPS sepenuhnya berasal dari ingatan model atas nama
produk retail, sehingga bisa meleset berkali lipat dan berubah skala antar
perhitungan. Tiga tambahan menambatkannya:

| Berkas | Perannya |
|---|---|
| [`lib/pc-prebuild/hardware-specs.ts`](../src/lib/pc-prebuild/hardware-specs.ts) | Nama retail → spesifikasi terurai. Model menerima `RTX 4060, VRAM 8GB`, bukan `"VGA GEFORCE RTX 4060 EAGLE OC 8GB"`. |
| [`lib/pc-prebuild/performance-reference.ts`](../src/lib/pc-prebuild/performance-reference.ts) | Tangga GPU, bobot per game, plafon prosesor, batas VRAM/RAM, penskalaan antar sel. ~1.170 token. |
| [`lib/pc-prebuild/fps-plausibility.ts`](../src/lib/pc-prebuild/fps-plausibility.ts) | Menandai urutan sel terbalik & rasio 1% low mustahil, di panel admin. Tidak memperbaiki apa pun. |

**Anggaran token masih lapang:** prompt penuh ~1.945 token dari anggaran 3.500
(`inputTokenBudget` pada `openai/gpt-oss-120b` dengan `max_tokens` 4.000). Kalau
tabel acuannya diperpanjang, ukur ulang — `checkInputFits` menolak lebih dulu
dengan pesan jelas, tapi itu berarti paket berkomponen banyak tidak bisa
dianalisis.

Yang IKUT DIBUANG dan jangan dikembalikan: aturan prompt *"angkanya harus turun
secara masuk akal saat resolusi naik"*. Ia memaksa kurva GPU-bound untuk semua
game, padahal CS2 dan Valorant di 720p dibatasi prosesor — akibatnya paket
ber-prosesor lemah tampil sanggup ratusan FPS hanya karena resolusinya
diturunkan.

Ini tetap perkiraan AI, bukan hasil ukur; hasilnya tetap draf yang disetujui
staff lebih dulu.

### `pc-prebuild-performance`: satu panggilan, dan sempat dua

Selama 24–26 Agustus 2026 endpoint ini menjalankan panggilan KEDUA ke
`openai/gpt-oss-20b` untuk memilih produk pengganti dari katalog, melengkapi
daftar saran upgrade. **Fitur saran upgrade dibuang 26 Agustus 2026** atas
keputusan pemilik produk, dan panggilan keduanya ikut hilang.

Satu hal dari periode itu tetap berlaku kalau suatu saat butuh dua panggilan
lagi: **pisahkan modelnya.** `max_tokens` dipesan di muka terhadap TPM, dan TPM
dihitung PER MODEL — dua panggilan ke model yang sama berebut ember yang sama,
dua model berbeda punya ember masing-masing.

### Token penalaran ikut memakan `max_tokens`

Catatan lama di kedua endpoint produk menyatakan `openai/gpt-oss-*` dan
`qwen/qwen3.6-27b` "membalas 400 Failed to validate JSON" pada mode
`response_format: json_object`. **Itu keliru.** Penyebab aslinya `max_tokens`
yang kekecilan: ketiga model itu menulis token penalaran lebih dulu, dan
penalaran ikut dihitung terhadap `max_tokens`. Kalau jatahnya habis sebelum
JSON-nya keluar, Groq membalas `json_validate_failed` dengan `failed_generation`
kosong — terbaca seperti model yang tidak sanggup, padahal ia cuma terpotong.

Diukur pada prompt analisis performa (input ~1.400 token):

| Model | `max_tokens` | Hasil |
|---|---|---|
| `openai/gpt-oss-120b` | 200 | ❌ `json_validate_failed` |
| `openai/gpt-oss-120b` | 2500 | ✅ 856 token keluar, 3,4 dtk |
| `openai/gpt-oss-120b` | 4000 | ✅ matriks FPS penuh: 2.836 token keluar, 5,9 dtk |
| `qwen/qwen3.6-27b` | 4000 | ✅ |
| `groq/compound` | — | ❌ 413, lalu 429 — lihat di bawah |

Jadi saat memilih model untuk endpoint AI baru: cek dulu daftar model yang
benar-benar ada (`GET https://api.groq.com/openai/v1/models`), dan beri
`max_tokens` yang memuat penalaran, bukan cuma keluarannya.

### `groq/compound` bukan model — ia ROUTER, dan TPM-nya menyesatkan

`GROQ_TPM` mencatat `groq/compound` = 70.000, dan header
`x-ratelimit-limit-tokens` di endpoint itu memang membalas 70.000. **Angka itu
tidak bisa dipakai untuk menghitung muat-tidaknya sebuah permintaan.** Compound
menjalankan model lain di dalamnya, dan yang benar-benar mengikat adalah TPM
model internal itu. Diukur 26 Agustus 2026:

```
429 Rate limit reached for model `meta-llama/llama-4-scout-17b-16e-instruct`
    … tokens per minute (TPM): Limit 30000, Used 27359, Requested 13501
```

Perhatikan `Requested 13501` untuk permintaan berisi 1.255 token input dengan
`max_tokens` 8.000 — router itu **menggandakan** pemakaian karena memanggil
beberapa model internal (terlihat di `usage_breakdown` pada balasan yang
berhasil). Jangan memilih compound berdasarkan angka TPM-nya.

### Kalau keluarannya kebanyakan, perpendek SKEMA-nya dulu, bukan ganti model

Matriks FPS `game × 3 resolusi × 3 setelan` berarti 108 baris untuk dua belas
game. Dengan kunci panjang (`gameId`/`resolution`/`quality`/`avg`/`low`) itu di
luar jangkauan model mana pun yang tersedia di akun ini. Dengan kunci pendek
(`g`/`r`/`q`/`a`/`l`) ia muat lapang di model yang sudah dipakai — 108 dari 108
sel terisi, `finish_reason: "stop"`.

Kuncinya tetap **eksplisit**, bukan array berurutan tanpa nama. Array berurutan
lebih hemat lagi, tapi model yang menukar urutan menghasilkan angka yang salah
secara diam-diam — dan angka FPS yang salah tidak punya gejala apa pun sampai
ada pelanggan yang mengeluh. Pemetaan kunci pendek → bentuk panjang tinggal di
route handler-nya saja; yang tersimpan dan yang dibaca halaman selalu bentuk
panjang.

Ketiganya memakai penjaga yang sama di
[`lib/api/groq/rate-limit.ts`](../src/lib/api/groq/rate-limit.ts): `max_tokens`
DIPESAN di muka terhadap jatah TPM, jadi permintaan dicek muat (`checkInputFits`)
**sebelum** dikirim, dan galat 413/429 diterjemahkan jadi pesan yang berguna
(`rateLimitResponse`) alih-alih JSON mentah berisi id organisasi.

Balasan model diperlakukan sebagai data asing: `pc-prebuild-performance`
menjalankannya lewat parser yang sama dengan yang dipakai saat membaca dari
database (`parsePrebuildPerformance`) — id di luar katalog dibuang, angka
dijepit, teks dipotong. Rinciannya di
[`docs/11-pc-prebuild.md` §9](./11-pc-prebuild.md).

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

---

## 13. Keranjang: paket PC Prebuild sebagai satu blok (28 Agustus 2026)

Ditambahkan bersama halaman pelanggan `/pc-prebuild` — lihat
[`docs/11-pc-prebuild.md`](./11-pc-prebuild.md).

### Paket TIDAK punya jalur harga sendiri

Satu paket berisi 6–8 produk, dan yang masuk keranjang adalah **komponennya
satu per satu**, bukan satu baris "paket". Tiap baris tetap membawa `productId`
katalog yang sungguhan, jadi `priceCartFromCatalog()` bekerja persis seperti
untuk barang lepas: satu kueri, harga dibaca ulang di server, varian tetap
dibaca dari baris variannya.

Alternatifnya — satu baris keranjang untuk seluruh paket — menuntut jalur harga
KEDUA di server, karena paket tidak punya `productId`. Jalur harga adalah satu-
satunya tempat di repo ini yang paling tidak boleh punya dua versi (CLAUDE.md
§2.7), jadi yang dipilih adalah menjadikannya satu kesatuan di lapisan
**tampilan** saja:

| Lapis | Bentuknya |
|---|---|
| `store/cart.ts` | baris terpisah, masing-masing membawa `bundle: CartBundleRef` |
| `lib/cart/grouping.ts` | `groupCartItems()` mengembalikannya jadi satu blok |
| `/cart`, panel keranjang, `/checkout` | satu blok bernama, satu harga, tanpa harga satuan |
| `prepareCheckoutWhatsApp` | satu nomor bernama di pesan, komponennya menjorok |

`groupCartItems()` dipakai **ketiga** halaman itu. Kalau tiap halaman
mengelompokkan sendiri, cepat atau lambat ada satu yang menampilkan tujuh
komponen berserakan sementara dua lainnya menampilkannya sebagai paket — dan
pelanggan tidak punya cara tahu mana yang benar.

### `CartItem.id` sekarang punya segmen ketiga

```
"123"              produk biasa
"123_456"          varian — 456 yang memegang harga
"123_456_bKUNCI"   komponen paket (varian)
"123__bKUNCI"      komponen paket (bukan varian) — segmen tengah kosong
```

Segmen ketiga membuat satu produk bisa hidup di dua paket sekaligus, atau di
sebuah paket sekaligus berdiri sendiri, tanpa `addItem` menggabungkan keduanya.
**Segmen 0 dan 1 tidak boleh berpindah tempat:** `priceBearingId()` di
`features/checkout/actions.ts` membaca segmen ke-2 untuk menentukan baris mana
yang memegang harga. Ketiga bentuk lama masih beredar di localStorage pelanggan
dan wajib terus dibaca — keranjang tidak pernah dimigrasi.

### `prepareCheckoutWhatsApp`: baris dirakit dari INPUT, bukan dari `cart.lines`

`priceCartFromCatalog()` **menggabungkan** baris berid sama — perilaku yang benar
untuk menghitung, tapi merusak begitu produk yang sama bisa berada di sebuah
paket sekaligus berdiri sendiri: yang tergabung kehilangan paketnya, dan
`unitPriceByCartItemId` cuma terisi untuk salah satu barisnya.

Karena itu hasil kueri dipakai sebagai **kamus harga** (`id → unitPrice`), dan
daftar yang dikirim dirakit dari input klien. Harga yang dipakai tetap
seluruhnya dari katalog; yang datang dari klien hanya id, kuantitas, dan
keterangan paket.

`CheckoutLineInput` bertambah tiga bidang **opsional** — `bundleKey`,
`bundleName`, `bundleQuantity` — dan ketiganya HANYA memengaruhi cara pesan
disusun.

### Paket yang komponennya hilang TIDAK dikirim, seluruhnya

Kalau satu komponen sudah ditarik dari katalog, **seluruh paketnya** ditahan —
bukan komponennya saja yang dibuang. PC yang kehilangan motherboard-nya bukan
pesanan yang lebih murah, ia pesanan yang tidak bisa dipenuhi, dan totalnya akan
terlihat sah sampai CS membukanya.

Ditegakkan **di server** (`prepareCheckoutWhatsApp`), dan dicerminkan di klien
lewat `isGroupBlocked()` supaya tombolnya tidak menjanjikan sesuatu yang akan
ditolak. Yang memutuskan mengeluarkan paketnya tetap pelanggan; tidak ada yang
dihapus otomatis.

---

## 14. PC Builder: produk bervarian (31 Agustus 2026)

### `fetchBuilderProducts` tidak lagi mengunci `type: "SIMPLE"`

Filternya kini `type: { in: ["SIMPLE", "VARIABLE"] }`, ditambah cabang `OR`
untuk induk VARIABLE yang harganya nol tapi variannya berharga — tanpa cabang
itu seluruh produk bervarian tetap hilang walau filternya sudah longgar.
VARIATION **tidak** ikut: ia dipilih lewat induknya, bukan berdiri sendiri di
grid.

Pelonggaran ini SATU PAKET dengan
`features/builder/components/variation-picker-dialog.tsx`. Kuncinya dulu ada
justru karena wizard tidak punya cara memilih varian; kalau dialog itu suatu
hari dibongkar, kuncinya harus kembali bersamanya.

### Yang masuk rakitan adalah id baris VARIATION

Baris varian juga sebuah `Product` dengan harga, stok, dan SKU sendiri. Karena
itu `BuilderProduct.id` diisi id variannya, dan seluruh jalur hilir tidak
berubah sama sekali:

| Jalur | Perlakuannya |
|---|---|
| `priceCartFromCatalog()` | produk biasa, satu id |
| `/build-pc/print?items=` | format `stepId:productId:qty` tetap, tautan lama tetap sah |
| `recordPcBuildQuote()` | satu baris item, seperti komponen lain |
| `SavedPcBuild.items` | `{ stepId, productId, quantity, price }` tetap |

Alternatifnya — menyimpan id induk + `variationId` terpisah — menuntut
perubahan di kelima bentuk di atas sekaligus, termasuk format URL yang sudah
tersebar lewat WhatsApp. Jalur harga adalah tempat yang paling tidak boleh
disentuh tanpa alasan (CLAUDE.md §2.7).

Konsekuensi yang harus diingat: `BuilderProduct.attributes` untuk pilihan
varian diisi dari **INDUK**, bukan dari baris variannya. Atribut sebuah varian
adalah pembedanya (Kapasitas, Warna); socket sebuah motherboard tidak pernah
tercatat di sana, dan memakai atribut varian akan membuat langkah yang
bergantung pada socket membuang pilihan yang sebenarnya cocok — diam-diam.

### Opsi yang dipilih dilaporkan terpisah, tidak disambung ke `name`

Tiga lapisan baca bertambah dua medan, keduanya `null` untuk komponen biasa:

| Lapisan | Medan baru |
|---|---|
| `PricedCartLine` (`cart-pricing.ts`) | `parentName`, `variationLabel` |
| `QuoteLineItem` (`pc-build-quotes.ts`) | `parentName?`, `variationLabel?` |
| `ResolvedBuildItem.product` (`saved-pc-builds.ts`) | `variationLabel` |

Semuanya dirangkai lewat satu aturan di
[`lib/utils/variation.ts`](../src/lib/utils/variation.ts), yang menyusun label
dari **nilai atribut** — bukan dari `name`. Nama baris varian tidak bisa
dipercaya sebagai pembeda: varian warisan impor WooCommerce sering hanya
mengulang nama induknya utuh, sehingga dua baris bisa terbaca identik untuk dua
barang berbeda harga.

`name` sendiri sengaja TIDAK diubah isinya. `prepareCheckoutWhatsApp`
memakainya apa adanya untuk pesan pemesanan dan daftar barang yang hilang;
menyisipkan label ke dalamnya berarti mengubah jalur checkout demi kebutuhan PC
Builder. Karena itu pula `PrepareCheckoutResult.lines` sekarang bertipe
`CheckoutResultLine` sendiri, bukan meminjam `PricedCartLine` — ia memang tidak
pernah mengisi kedua medan itu.

`QuoteLineItem` menumpang kolom `items` yang bertipe Json, jadi tambahan ini
**tidak butuh migrasi** dan tidak merusak quotation lama: yang dicetak sebelum
medan ini ada tinggal tidak memilikinya, dan pembacanya jatuh ke `name`.
Keduanya juga TIDAK ikut ke `computeContentHash` — varian berbeda sudah pasti
id berbeda, jadi menambahkannya tidak memisahkan apa pun yang belum terpisah,
tapi akan menerbitkan kode baru untuk quotation lama yang isinya tidak berubah.

---

## Sinkronisasi WooCommerce (`lib/api/woocommerce/sync/`)

> Ditambahkan 29 Agustus 2026. Baca ini sebelum menyentuh apa pun di folder itu.

### Kenapa ada folder yang benar-benar memanggil WooCommerce

Sisa `lib/api/woocommerce/` sudah tidak memanggil WooCommerce sama sekali —
namanya historis, isinya query Prisma (CLAUDE.md §2.2). Folder `sync/` adalah
**satu-satunya pengecualian**: ia bicara ke WooCommerce lewat HTTP.

Alasannya faktual, bukan warisan: situs WordPress lama **masih dipakai staff
setiap hari**. Saat fitur ini dibuat, produk terakhir di WooCommerce dimodifikasi
pada hari yang sama, dan 167 produk lahir di sana setelah katalog kita diimpor.

### Berkas

| Berkas | Tugas |
|---|---|
| `types.ts` | Bentuk data. Murni tipe — aman diimpor Client Component. |
| `remote.ts` | Mengambil produk dari WooCommerce REST (paginasi, 4 permintaan paralel, batas 80 halaman). |
| `local.ts` | Satu kueri Prisma untuk seluruh katalog + nama kategori + jejak suntingan harga. |
| `diff.ts` | **Fungsi murni.** Membandingkan kedua sisi. Tanpa database, tanpa jaringan. |
| `preview.ts` | Merangkai ketiganya. Tidak menulis apa pun. |

### Endpoint

`POST /api/admin/sync/preview` — dijaga `requireAuth()`, `dynamic = "force-dynamic"`,
`maxDuration = 60`. Body: `{ modifiedAfter?: string | null }`. **Hanya membaca.**

Memakai POST walaupun sifatnya membaca, supaya hasilnya tidak pernah masuk cache:
pratinjau yang basi menampilkan selisih harga yang sudah tidak ada.

### Dua jebakan yang sudah ditemukan dan ditutup

**1. Induk produk variable tidak punya harga sendiri.** WooCommerce menyimpan
harga di tiap varian dan membiarkan `regular_price` induknya kosong. Versi
pertama membandingkannya apa adanya dan melaporkan **1.312** perubahan harga —
823 di antaranya "ubah menjadi kosong" untuk setiap produk variable yang kita
punya. Menerapkannya berarti menghapus harga yang tampil ke pelanggan untuk
seperempat katalog (CLAUDE.md §2.7). Sekarang induk variable dilewati sebelum
apa pun dibandingkan, jumlahnya dilaporkan lewat `skippedVariableParents`, dan
angka yang sebenarnya adalah **489**.

Aturan umumnya: **harga kosong di sumber berarti "tidak dinyatakan di sana",
bukan "harganya nol".** Sinkronisasi tidak pernah mengosongkan harga.

**2. `date_created_gmt`, bukan `date_created`.** WooCommerce mengirim waktu GMT
tanpa akhiran `Z`; `new Date()` menafsirkannya sebagai waktu lokal dan meleset
tujuh jam di WIB. Cukup untuk salah mengelompokkan produk yang dibuat pagi hari.

### Yang BELUM tercakup

> Daftar hidup beserta siapa yang memegangnya ada di
> [`docs/12-kendala-terbuka.md`](./12-kendala-terbuka.md).

- **Harga varian.** Endpoint `/products` tidak mengembalikan varian, dan
  perubahan harga varian tidak selalu mendorong `date_modified` induknya.
  Menyusurinya berarti satu permintaan per induk variable (823 saat ini).
- **Varian yang hilang dari induk yang sudah ada** (±216 saat fitur ini dibuat).
- **Penghapusan.** Produk yang hilang atau di-trash di WooCommerce tidak
  disentuh, dan memang tidak akan pernah disentuh oleh fitur ini.

### Penerapan harga (`sync/apply.ts` → `POST /api/admin/sync/apply`)

Body permintaan **hanya berisi daftar `wooId`** — tidak ada harga di dalamnya.
Harganya diambil ulang dari WooCommerce di dalam `applyPriceChanges`
(`fetchRemoteProductsByIds`). Dua alasan, keduanya nyata:

1. Endpoint yang menerima harga dari klien berarti siapa pun yang bisa
   memanggilnya bisa menetapkan harga katalog (CLAUDE.md §2.7).
2. Pratinjau bisa berumur beberapa menit. Menuliskan angka dari pratinjau
   berarti menyimpan harga yang mungkin sudah berubah lagi di sumbernya.

**Penjagaan diulang di titik penulisan**, bukan dipercayakan pada pratinjau —
urutannya: tidak ada di katalog → `source = LOCAL` → tidak ada di WooCommerce →
induk variable → harga kosong di sumber → harga sudah sama. Sisi kita diperiksa
lebih dulu dengan sengaja: produk buatan panel umumnya tidak ada di WooCommerce,
dan kalau urutannya dibalik ia ditolak dengan alasan "terhapus di sana" — benar
hasilnya, menyesatkan keterangannya.

Ditulis per **50 produk per transaksi**: satu transaksi untuk ratusan baris
berisiko melewati batas waktu, dan kegagalan di baris ke-400 akan membatalkan
399 pembaruan yang sudah benar. Setiap potongan tetap utuh — harga dan baris
lognya tersimpan bersama atau tidak sama sekali.

#### Aksi log `SYNC_PRICE`

Perubahan dari sinkronisasi dicatat sebagai **`SYNC_PRICE`**, bukan
`UPDATE_PRICE`. Bedanya bukan kosmetik: pratinjau menandai produk yang harganya
"pernah disunting staff" dengan membaca `product_logs`, jadi kalau penerapannya
sendiri ikut tercatat sebagai `UPDATE_PRICE`, **seluruh produk akan tertandai
setelah sekali penerapan** dan tandanya berhenti berarti apa-apa.
`local.ts` karena itu mengecualikan `SYNC_PRICE` saat menghitung
`priceEditedWooIds`.

Barisnya tetap disusun lewat `lib/logs/product-log.ts` seperti semua penulis log
lain (helper itu menerima `priceAction` opsional). `userName` diisi nama admin
yang menekan tombol — yang memutuskan menerapkan tetap orang.

`logs-table.tsx` mengenali aksi ini: label "Sinkron Harga (WooCommerce)", warna
badge sendiri, dan nilainya ikut diformat sebagai rupiah.

### Import produk baru (`sync/import.ts` → `POST /api/admin/sync/import`)

**Memakai ulang `createProduct()`** — jalur yang sama dengan form produk di panel
admin — bukan menulis pembuatan produk versi kedua. Fungsi itu sudah menangani
kategori (termasuk menandai yang terdalam sebagai kategori utama), gambar,
upsert atribut ke master data, upsert brand, dan varian.

Bedanya hanya lewat `CreateProductOptions`: nomornya memakai id asli WooCommerce
dan barisnya ditandai `source = WOO`.

#### Varian harus mewarisi asal-usul induknya

Versi pertama melewatkan ini dan cacatnya baru ketahuan saat pengujian: varian
hasil import mendapat nomor dari **pita LOCAL** (900000000+) dan ditandai
`LOCAL`, karena `syncProductVariations` selalu memanggil `nextWooId()` untuk
varian baru. Akibatnya varian itu tidak akan pernah bisa dicocokkan lagi dengan
WooCommerce — harga varian berhenti bisa disinkronkan, dan import berikutnya
menggandakannya alih-alih mengenalinya.

Sekarang `syncProductVariations` menerima `VariationOrigin`. Kosong (bawaan)
berarti varian lahir di panel admin: pita LOCAL, ditandai `LOCAL`. Importer
mengoper `WOO`, dan varian memakai id WooCommerce-nya sendiri.

#### Status: ikut WooCommerce, kecuali kategorinya tidak ketemu

Kategori WooCommerce dicocokkan dengan taksonomi kita **berdasarkan nama**
(`Category` tidak punya `wooId` — taksonominya hasil kurasi berbasis `path`).
Saat fitur ini dibuat, 161 dari 170 produk cocok.

Yang tidak cocok **tidak ditebak**: produknya turun jadi `draft` apa pun
statusnya di WooCommerce. Produk tanpa kategori tidak punya rumah di navigasi
maupun breadcrumb, dan katalog ini sudah menanggung ribuan produk seperti itu.

#### Gambar dipindahkan ke host media sendiri

URL gambar dari WooCommerce ditulis ulang ke `media.hnsitcenter.com` lewat
`toMediaUrl()`: host media memangkas `/wp-content/uploads`, jadi
`hnsitcenter.id/wp-content/uploads/2026/08/x.webp` menjadi
`media.hnsitcenter.com/2026/08/x.webp`. Pemetaan itu bukan tebakan — ia
mengikuti bentuk 12.832 baris yang sudah ada sejak import katalog pertama.
URL yang bentuknya di luar dugaan dikembalikan apa adanya, tidak dipaksa.

Baris yang terlanjur tersimpan dengan host lama sudah dipindahkan sekali jalan
oleh `scripts/archive/rewrite-product-image-host.mjs` (875 baris, 29 Agustus
2026). Sesudahnya seluruh 13.707 gambar berada di satu host.

> **Yang harus diketahui:** saat pemindahan ini dilakukan, berkas unggahan
> 2026/08 ke atas **belum ada** di host media dan menjawab **404**, sementara
> URL WordPress aslinya menjawab 200. Jadi gambar produk hasil import akan
> kosong sampai sinkronisasi media menyusul — pekerjaan terpisah di luar
> aplikasi ini. Keputusannya diambil sadar: lebih baik katalog menunjuk satu
> host dan menunggu berkasnya menyusul daripada bercabang jadi dua host yang
> harus dijaga selamanya.

Catatan: `NEXT_PUBLIC_IMAGE_DOMAIN` di `config/env.ts` **terlihat** seperti
tempat host ini seharusnya tinggal, tapi variabel itu kode mati — tidak dibaca
satu berkas pun, dan isinya masih host WordPress lama. Jangan membangun di
atasnya sebelum ia dibereskan.

#### Kegagalan setelah commit

`createProduct` membuang cache Next **setelah** transaksinya commit. Kalau
langkah terakhir itu yang gagal, produknya sudah benar-benar ada — melaporkannya
sebagai gagal akan membuat staff mengimpornya lagi, dan percobaan kedua menabrak
`@unique` pada `woo_id` tanpa penjelasan yang masuk akal. Importer karena itu
memeriksa dulu apakah barisnya ada sebelum menyimpulkan gagal.

#### Aksi log `SYNC_IMPORT`

Setiap produk yang masuk mencatat satu baris `SYNC_IMPORT` dengan `userName`
admin yang menekan tombol. `logs-table.tsx` mengenalinya.

## 15. Banner: kampanye penaung (`banner_batches`) — 31 Agustus 2026

Model `BannerBatch` sudah ada di skema sejak commit `87fe725` (29 Agustus),
tapi tanpa satu baris kode pun yang memakainya. Bagian ini mencatat lapisan
data yang akhirnya mengisinya.

### Dua lapisan, satu query

| Berkas | Isinya |
|---|---|
| [`lib/api/banners.ts`](../src/lib/api/banners.ts) | banner + relasi `batch` |
| [`lib/api/banner-batches.ts`](../src/lib/api/banner-batches.ts) | CRUD kampanye untuk panel admin |

`banner-batches.ts` **tidak** memakai `unstable_cache`. Gerbang tayang milik
kampanye dibaca lewat `include: { batch: true }` di `getActiveBanners()` — satu
query, satu entri cache, satu tag (`promo-banners`). Cache kedua hanya menambah
tempat yang bisa basi sendiri, dan yang basi di sini berarti banner promo
tayang atau hilang di waktu yang salah.

### Gerbangnya dihitung saat dibaca, sama seperti jadwal banner

`effectiveBannerState()` di [`lib/utils/banner.ts`](../src/lib/utils/banner.ts)
menggabungkan dua jadwal: banner baru tayang kalau **dirinya sendiri DAN
kampanye penaungnya** sama-sama sedang tayang. Perhitungannya tetap di luar
`unstable_cache` dengan alasan yang sudah ditulis di berkas itu — "sekarang"
yang dipakai harus saat permintaan, bukan saat entri cache dibuat.

Fungsinya murni (tanpa Prisma) supaya daftar di admin dan penyaring di beranda
memakai aturan yang sama persis. Kalau lencana "Tayang" di admin dan isi
beranda bisa berbeda, yang salah bukan datanya — melainkan ada dua aturan.

### Kampanye yang dihapus BERHENTI menjadi gerbang

`softDeleteBatch()` hanya mengisi `deletedAt` (CLAUDE.md §2.8 — ini data
operasional HNS, dan barisnya justru arsip kampanyenya). Baik
`getActiveBanners()` maupun daftar admin menyaring kampanye ber-`deletedAt`
menjadi `null` sebelum dipakai sebagai gerbang: setelah dihapus ia tinggal
label pada tiap banner, bukan lagi penentu tayang.

Akibat yang disengaja: menghapus kampanye yang sedang mematikan banner membuat
banner itu kembali mengikuti setelannya sendiri — dan bisa langsung tayang.
Karena itu `getAllBatches()` ikut menghitung `heldBannerCount`, dan dialog
konfirmasi hapus menyebut angkanya sebelum staff menekan Hapus. Alternatifnya
(kampanye terhapus tetap menahan) membuat banner bisa tersembunyi selamanya
oleh baris yang sudah tidak muncul di layar mana pun.

### Revalidation

Seluruh aksi kampanye (`createBannerBatch`, `updateBannerBatch`,
`deleteBannerBatch` di `app/admin/(panel)/banner/actions.ts`) memanggil
`revalidateBannerPages()` yang sama dengan aksi banner: tag `promo-banners`,
lalu `/admin/banner` dan `/`. Mengubah jadwal kampanye mengubah isi beranda,
jadi keduanya tidak boleh dipisah.

### Urutan tampil: blok kampanye dulu, lalu `sortOrder`

`sortBannersForDisplay()` (di `lib/utils/banner.ts`) adalah satu-satunya aturan
urutan, dipakai `getActiveBanners()` **dan** daftar admin:

1. Banner milik kampanye yang **sedang tayang** naik ke depan sebagai satu
   blok — kalau kampanyenya punya enam banner, keenamnya yang pertama dilihat
   pengunjung.
2. Di dalam masing-masing blok, urut menurut `sortOrder`.

Kampanye yang belum mulai, sudah berakhir, dimatikan, atau dihapus tidak
mengunci apa pun; anggotanya ikut antre seperti banner biasa.

### `sortOrder` hanya ditulis oleh `reorderBanners`

Kolom isian "Urutan Tampil" sudah **dibuang** dari formulir banner. Kotak angka
dan daftar seret adalah dua sumber kebenaran untuk hal yang sama, dan yang satu
menimpa yang lain tanpa diketahui staff — persis yang sudah diperingatkan
komentar di `prisma/schema.prisma`.

| Operasi | Perlakuan `sortOrder` |
|---|---|
| `createBanner()` | `max(sortOrder) + 1` — banner baru selalu paling bawah |
| `updateBanner()` | tidak disentuh sama sekali |
| `reorderBanners(ids)` | menulis ulang **seluruhnya** jadi 0..n-1 dalam satu transaksi |

`ids` wajib memuat SELURUH banner, bukan hanya yang sedang tayang: menulis ulang
sebagian membuat nomor yang tidak ikut ditulis bertabrakan dengan yang baru, dan
dua banner yang berbagi nomor membuat beranda memilih salah satunya sembarang.
Satu transaksi dipakai supaya tidak pernah ada keadaan separuh lama separuh baru.

Di sisi klien urutannya ditahan `useOptimistic`, bukan state biasa — baris pindah
seketika saat dilepas, lalu kembali mengikuti data server begitu
`router.refresh()` selesai. Tidak ada salinan urutan yang hidup sendiri di klien.
