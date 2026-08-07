# 02 — Architecture

> Baca dokumen ini sebelum membuat file/folder baru, memutuskan Server vs Client Component, atau menyusun layer baru.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (User)                                     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Next.js App Router (Vercel / VPS)                  │
│  ├─ Server Components → SSR/ISR                     │
│  ├─ Client Components → Interaktivitas              │
│  ├─ Route Handlers → BFF (proxy ke WooCommerce)     │
│  └─ Middleware → Auth, redirect, geo                │
└──────┬────────────────────────────┬─────────────────┘
       │                            │
       ▼                            ▼
┌──────────────────┐        ┌──────────────────────┐
│ WooCommerce API  │        │  Layanan pendukung   │
│ (WordPress)      │        │  - Search (opsional) │
│ - Products       │        │  - Payment (MT/XN)   │
│ - Categories     │        │  - WhatsApp CS       │
│ - Orders         │        │  - Object storage    │
│ - Customers      │        └──────────────────────┘
└──────────────────┘
```

**Prinsip:** Next.js adalah **presentation + BFF (Backend For Frontend)**, bukan pemilik data. Sumber data resmi = WooCommerce.

---

## 2. Struktur Folder

Struktur berbasis **fitur (feature-based)**, bukan tipe file. Alasan: kode terkait satu fitur ada di satu tempat, memudahkan onboarding & maintenance.

```
/
├── CLAUDE.md
├── .env.example
├── .env.local                    ← JANGAN commit
├── docs/                         ← Semua panduan agent
├── public/                       ← Aset statis (logo, favicon, banner statis)
│
├── src/
│   ├── app/                      ← Next.js App Router
│   │   ├── (marketing)/          ← Route group: home, about, blog
│   │   │   ├── page.tsx
│   │   │   ├── about/
│   │   │   └── blog/
│   │   ├── (shop)/               ← Route group: katalog & checkout
│   │   │   ├── shop/
│   │   │   ├── product/[slug]/
│   │   │   ├── category/[slug]/
│   │   │   ├── brand/[slug]/
│   │   │   ├── cart/
│   │   │   └── checkout/
│   │   ├── (services)/           ← Route group: layanan
│   │   │   ├── build-pc/
│   │   │   └── service/
│   │   ├── (account)/            ← Route group: user account
│   │   │   ├── account/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── api/                  ← Route Handlers (BFF)
│   │   │   ├── revalidate/       ← Webhook dari WooCommerce
│   │   │   └── whatsapp/         ← Helper generate WA link
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── features/                 ← Logika per fitur
│   │   ├── product/
│   │   │   ├── components/       ← ProductCard, ProductGrid, ProductGallery
│   │   │   ├── hooks/            ← useProductFilters
│   │   │   ├── services/         ← productService.ts (call ke API)
│   │   │   └── types.ts
│   │   ├── cart/
│   │   │   ├── components/
│   │   │   ├── store/            ← cartStore (Zustand)
│   │   │   └── types.ts
│   │   ├── wishlist/
│   │   ├── checkout/
│   │   ├── search/
│   │   ├── pc-builder/           ← Fitur custom, bukan WooCommerce
│   │   └── service-booking/
│   │
│   ├── components/               ← Komponen GLOBAL reusable
│   │   ├── ui/                   ← shadcn/ui primitives (Button, Input, dsb)
│   │   ├── layout/               ← Header, Footer, Container
│   │   ├── seo/                  ← JsonLd, Breadcrumb
│   │   └── shared/               ← WhatsAppButton, PriceTag, StockBadge
│   │
│   ├── lib/                      ← Utility & infra
│   │   ├── api/
│   │   │   ├── woocommerce/      ← Client WooCommerce (auth, base URL)
│   │   │   │   ├── client.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── categories.ts
│   │   │   │   └── orders.ts
│   │   │   └── whatsapp.ts
│   │   ├── utils/                ← formatPrice, slugify, cn
│   │   ├── constants/            ← Konstanta global (rute, kategori khusus)
│   │   └── validators/           ← Schema Zod
│   │
│   ├── config/                   ← Konfigurasi env, site
│   │   ├── env.ts                ← Validasi env dengan Zod
│   │   └── site.ts               ← Nama, deskripsi, sosmed
│   │
│   ├── types/                    ← Type global (WooCommerce, dsb)
│   │   ├── woocommerce.ts
│   │   └── index.ts
│   │
│   └── styles/                   ← File CSS tambahan (jika perlu)
│
├── tests/                        ← Unit & integration test
└── .storybook/                   ← Storybook (opsional, untuk komponen UI)
```

**Aturan:**
- Kode yang dipakai di > 1 fitur → naik ke `components/` atau `lib/`.
- Kode yang dipakai di 1 fitur → tetap di `features/<nama-fitur>/`.
- Jangan buat folder baru tanpa alasan jelas.

---

## 3. Layer Arsitektur

Meskipun tidak dipisah folder sepenuhnya, kode secara logis dibagi jadi 4 layer:

| Layer | Isi | Contoh |
|---|---|---|
| **Presentation** | UI (JSX/TSX), styling, event handler | `ProductCard.tsx`, `page.tsx` |
| **Application** | State, hook, orchestration | `useProductFilters.ts`, `cartStore.ts` |
| **Domain** | Type, aturan bisnis, validasi | `product.types.ts`, `priceCalculator.ts` |
| **Infrastructure** | API client, fetch, storage | `lib/api/woocommerce/products.ts` |

**Aturan dependency:** Presentation → Application → Domain → Infrastructure. Layer atas boleh depend ke layer bawah, tidak sebaliknya.

**Contoh salah:** `lib/api/woocommerce/products.ts` (Infrastructure) import dari `components/ProductCard.tsx` (Presentation). Ini circular & merusak arsitektur.

---

## 4. Server Component vs Client Component

Next.js App Router default ke **Server Component**. Gunakan Client Component **hanya jika benar-benar butuh**.

### 4.1 Wajib Server Component
- Halaman utama (`page.tsx`) untuk katalog, produk, kategori, blog.
- Komponen yang hanya render data tanpa interaktivitas.
- Komponen yang butuh akses langsung ke API (tanpa expose secret ke browser).
- Komponen SEO-critical (schema.org, meta).

### 4.2 Wajib Client Component (`"use client"`)
- Komponen dengan state lokal (useState, useReducer).
- Komponen dengan event handler user (onClick, onChange).
- Komponen dengan lifecycle (useEffect).
- Komponen yang pakai browser API (localStorage, window).
- Komponen yang pakai Zustand / TanStack Query.

### 4.3 Pola yang Dianjurkan

Bungkus interaktivitas dalam Client Component kecil, biarkan Server Component render sekitarnya:

```tsx
// ✅ BENAR — Server Component (page.tsx)
export default async function ProductPage({ params }) {
  const product = await getProduct(params.slug);
  return (
    <article>
      <ProductGallery images={product.images} />       {/* Server */}
      <ProductInfo product={product} />                {/* Server */}
      <AddToCartButton productId={product.id} />       {/* Client kecil */}
    </article>
  );
}

// ❌ SALAH — Membungkus semua di Client Component
"use client";
export default function ProductPage({ params }) {
  const [product, setProduct] = useState(null);
  useEffect(() => { fetch(...).then(...) }, []); // Kehilangan SSR & SEO
}
```

---

## 5. Routing & Route Groups

Route groups (nama folder dalam kurung) digunakan untuk mengelompokkan route **tanpa** mempengaruhi URL.

| Group | Isi | Layout khusus? |
|---|---|---|
| `(marketing)` | Home, About, Blog | Marketing layout (banner besar) |
| `(shop)` | Katalog, produk, cart, checkout | Shop layout (dengan filter sidebar) |
| `(services)` | Rakit PC, service booking | Service layout |
| `(account)` | Login, register, profile | Minimal layout |

**URL tetap `/product/xxx`, bukan `/(shop)/product/xxx`**.

---

## 6. API Layer (BFF Pattern)

Semua panggilan ke WooCommerce **wajib** lewat `lib/api/woocommerce/`. Alasan:

1. Menyembunyikan kredensial (consumer key/secret) dari browser.
2. Terpusat: caching, error handling, retry, logging.
3. Mudah di-mock untuk testing.
4. Jika suatu saat pindah ke Medusa/Saleor, hanya 1 folder yang perlu diubah.

### 6.1 Struktur `lib/api/woocommerce/`

```typescript
// client.ts — factory dengan auth Basic
export const wooClient = createClient({
  baseURL: env.WOOCOMMERCE_URL,
  auth: { key: env.WOOCOMMERCE_CONSUMER_KEY, secret: env.WOOCOMMERCE_CONSUMER_SECRET },
});

// products.ts — domain-specific
export async function getProducts(params: GetProductsParams): Promise<Product[]> { ... }
export async function getProductBySlug(slug: string): Promise<Product | null> { ... }
```

### 6.2 Route Handlers (`src/app/api/`)

Digunakan untuk:
- Menerima **webhook** dari WooCommerce (revalidate cache saat produk berubah).
- Endpoint yang perlu dipanggil dari client tanpa expose kredensial WooCommerce.
- Helper (misal generate URL WhatsApp).

**Bukan** untuk mem-proxy semua request produk — Server Component sudah bisa fetch langsung ke WooCommerce.

---

## 7. Fitur Custom Non-WooCommerce

Beberapa fitur **tidak ada di WooCommerce standar** dan perlu penanganan khusus:

### 7.1 Custom PC Builder
- Logika kompatibilitas part (socket CPU vs motherboard, PSU vs total wattage, dst) **tidak ada** di WooCommerce.
- Solusi: bangun state machine di `features/pc-builder/`, gunakan data produk WooCommerce sebagai sumber part, simpan rule kompatibilitas di file lokal (JSON/TypeScript).
- Hasil build bisa: (a) di-checkout sebagai bundle order di WooCommerce, atau (b) dikirim sebagai pesan WhatsApp ke CS untuk konfirmasi manual (Fase 1 lebih realistis).

### 7.2 Service Booking
- Bukan produk. Simpan sebagai submission ke backend sendiri (bisa: Next.js Route Handler + database ringan seperti Supabase/Neon, atau langsung kirim ke email/WhatsApp CS).
- Fase 1: form → kirim ke email + WhatsApp CS, no database.
- Fase 2: pindahkan ke database + admin panel untuk tracking.

---

## 8. Caching Strategy

Detail penuh ada di `docs/05-data-fetching.md`. Ringkasan:

| Data | Strategi Cache | Revalidation |
|---|---|---|
| Katalog produk | ISR (60–300 detik) | Webhook WooCommerce |
| Halaman produk | ISR (300–900 detik) | Webhook WooCommerce |
| Kategori & brand | ISR panjang (1 jam+) | Manual atau webhook |
| Cart, checkout, akun | No cache (dynamic) | — |
| Blog | ISR panjang (1 jam+) | Webhook |

---

## 9. Error Handling & Loading State

- Setiap route WAJIB punya `loading.tsx` dan `error.tsx` di level yang sesuai.
- Error tidak boleh menampilkan stack trace ke user — pakai pesan ramah + tombol "Coba lagi" / "Chat CS".
- Log error di production ke Sentry (atau alternatif) — konfigurasi di `lib/logger.ts`.

---

## 10. Yang TIDAK Boleh Dilakukan

- ❌ Fetch data langsung dari komponen tanpa lewat `lib/api/`.
- ❌ Expose consumer key WooCommerce ke client (`NEXT_PUBLIC_*`).
- ❌ Simpan data produk permanen di database Next.js.
- ❌ Membuat komponen "God Component" > 300 baris.
- ❌ Menaruh logika bisnis (harga, diskon, kompatibilitas) di komponen presentasi.
- ❌ Menambah dependency berat tanpa diskusi (contoh: seluruh Ant Design, Material UI, jQuery).
