# 06 — Coding Standards

> Baca dokumen ini sebelum menulis kode apapun.
> Tujuan: konsistensi lintas fitur & lintas developer (termasuk AI agent).

---

## 1. TypeScript

### 1.1 Strict Mode Wajib

`tsconfig.json` harus punya:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 1.2 `any` Dilarang
- Jangan pakai `any`. Titik.
- Kalau benar-benar tidak tahu tipe (contoh: data dari external tanpa schema), pakai `unknown` + narrowing dengan type guard atau Zod.

```typescript
// ❌ SALAH
function parseData(data: any) {
  return data.value;
}

// ✅ BENAR
function parseData(data: unknown) {
  if (
    typeof data === "object" &&
    data !== null &&
    "value" in data &&
    typeof (data as { value: unknown }).value === "string"
  ) {
    return (data as { value: string }).value;
  }
  throw new Error("Invalid data shape");
}

// ✅ LEBIH BAIK — pakai Zod
const Schema = z.object({ value: z.string() });
const parsed = Schema.parse(data);
```

### 1.3 Type vs Interface
- `type` untuk hampir semua kasus (props, unions, utility).
- `interface` hanya jika perlu extend / declaration merging.
- Jangan campur dalam satu file.

### 1.4 Enum → Union Literal
Hindari `enum` (menambah runtime code). Pakai union literal:

```typescript
// ❌ Enum
enum StockStatus { InStock, OutOfStock, Backorder }

// ✅ Union literal
type StockStatus = "instock" | "outofstock" | "onbackorder";
```

### 1.5 Utility Type
Manfaatkan utility bawaan TypeScript:
- `Partial<T>`, `Required<T>`, `Pick<T, K>`, `Omit<T, K>`.
- `ReturnType<F>`, `Awaited<T>`.
- Jangan duplikasi type — derive dari sumber tunggal.

---

## 2. Naming Convention

| Item | Aturan | Contoh |
|---|---|---|
| Variable | camelCase | `productList`, `totalPrice` |
| Konstanta global | UPPER_SNAKE_CASE | `MAX_QUANTITY`, `DEFAULT_PAGE_SIZE` |
| Fungsi | camelCase, verb | `getProduct`, `formatPrice` |
| Fungsi boolean | prefix `is/has/should/can` | `isInStock`, `hasVariations` |
| Komponen | PascalCase | `ProductCard` |
| Hook | camelCase, prefix `use` | `useCart`, `useProductFilters` |
| Type/Interface | PascalCase | `Product`, `CartItem` |
| File komponen | PascalCase | `ProductCard.tsx` |
| File util/hook | camelCase | `formatPrice.ts`, `useCart.ts` |
| Folder | kebab-case | `pc-builder/`, `service-booking/` |

### Semantik Nama
- **Deskriptif**, bukan pendek. `getProductById(id)` lebih baik dari `get(id)`.
- **Verb untuk fungsi**, noun untuk data. `handleClick`, bukan `click`.
- **Tanpa singkatan** kecuali umum (id, url, api, dsb).

```typescript
// ❌
const p = await fetch(...);
const arr = p.items;

// ✅
const productsResponse = await fetch(...);
const products = productsResponse.items;
```

---

## 3. Struktur Fungsi

### 3.1 Small & Focused
- 1 fungsi = 1 tanggung jawab.
- Idealnya ≤ 30 baris. Kalau > 50, kemungkinan bisa dipecah.

### 3.2 Early Return
Hindari nested if. Return awal jika kondisi tidak terpenuhi.

```typescript
// ❌
function getDiscount(product: Product) {
  if (product.on_sale) {
    if (product.regular_price) {
      const regular = Number(product.regular_price);
      const sale = Number(product.sale_price);
      if (regular > 0) {
        return Math.round((1 - sale / regular) * 100);
      }
    }
  }
  return 0;
}

// ✅
function getDiscount(product: Product): number {
  if (!product.on_sale) return 0;
  const regular = Number(product.regular_price);
  const sale = Number(product.sale_price);
  if (regular <= 0) return 0;
  return Math.round((1 - sale / regular) * 100);
}
```

### 3.3 Parameter Object untuk > 2 Argumen

```typescript
// ❌
function createOrder(userId, items, address, paymentMethod, note) { ... }

// ✅
function createOrder(params: {
  userId: number;
  items: CartItem[];
  address: Address;
  paymentMethod: PaymentMethod;
  note?: string;
}) { ... }
```

---

## 4. Business Logic Terpisah dari UI

Aturan: **komponen React tidak boleh mengandung logika bisnis yang tidak trivial.**

### Contoh yang Salah
```tsx
// ❌ Logika diskon di dalam komponen
export function ProductCard({ product }) {
  const discount = product.on_sale && product.regular_price
    ? Math.round((1 - Number(product.sale_price) / Number(product.regular_price)) * 100)
    : 0;
  return <div>{discount}% off</div>;
}
```

### Contoh yang Benar
```tsx
// lib/pricing.ts
export function calculateDiscount(product: Product): number { ... }

// ProductCard.tsx
import { calculateDiscount } from "@/lib/pricing";
export function ProductCard({ product }: { product: Product }) {
  const discount = calculateDiscount(product);
  return <div>{discount}% off</div>;
}
```

Manfaat: logika bisa di-test tanpa render komponen.

---

## 5. Import Order

Urutan import di setiap file:

```typescript
// 1. React / Next.js
import { useState } from "react";
import Link from "next/link";

// 2. Third-party
import { z } from "zod";
import { create } from "zustand";

// 3. Absolute internal (dari @/)
import { Button } from "@/components/ui/button";
import { getProducts } from "@/lib/api/woocommerce/products";

// 4. Relative
import { ProductCardImage } from "./ProductCardImage";
import type { ProductCardProps } from "./ProductCard.types";
```

Setiap grup dipisah 1 baris kosong.

**Absolute path (`@/`)** untuk semua import antar folder. Relative (`./`) hanya untuk file di folder yang sama.

---

## 6. Format & Style

- **Formatter:** Prettier (config di repo).
- **Linter:** ESLint dengan `eslint-config-next` + rules tambahan.
- **Indent:** 2 spasi.
- **Line width:** 100 karakter (soft limit).
- **Quote:** double quote (`"`) untuk JSX, konsisten single/double untuk TS (ikuti Prettier config).
- **Trailing comma:** yes (multi-line).
- **Semi-colon:** yes.

Setup pre-commit hook (Husky + lint-staged) agar format & lint jalan otomatis.

---

## 7. Komentar

### Kapan Perlu Komentar
- **Kenapa**, bukan **apa**. Kode sudah menjelaskan apa yang dilakukan.
- Business rule yang tidak jelas dari kode (contoh: "Diskon minimal 5% karena aturan promo XYZ").
- Workaround untuk bug/limitation library (link ke issue).
- TODO dengan tanggal & konteks: `// TODO(2026-08-01): pindah ke Meilisearch setelah Fase 2`.

### Kapan Tidak Perlu
```typescript
// ❌ Komentar noise
let total = 0; // total order
for (const item of items) { // loop items
  total += item.price; // tambah harga
}

// ✅ Kode sendiri sudah jelas
const total = items.reduce((sum, item) => sum + item.price, 0);
```

### JSDoc untuk Public API
Fungsi publik di `lib/` boleh punya JSDoc singkat:

```typescript
/**
 * Menghitung diskon dalam persen (0-100) dari harga produk.
 * Return 0 jika produk tidak on sale atau regular_price tidak valid.
 */
export function calculateDiscount(product: Product): number { ... }
```

---

## 8. Error Handling

### 8.1 Prinsip
- **Fail fast** — throw error di boundary (API layer), tangani di UI.
- Jangan swallow error dengan `catch {}` kosong.
- Setiap catch harus punya rencana: log, retry, fallback, atau propagate.

### 8.2 Custom Error Class
```typescript
export class WooApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public path: string,
  ) {
    super(message);
    this.name = "WooApiError";
  }
}
```

### 8.3 Catch Bertingkat
```typescript
try {
  const product = await getProduct(id);
  return product;
} catch (err) {
  if (err instanceof WooApiError && err.status === 404) {
    return null;
  }
  logger.error("Failed to fetch product", { id, err });
  throw err;
}
```

---

## 9. Testing (Ringkas)

Detail testing akan didokumentasikan terpisah. Aturan minimum:

- Fungsi utility di `lib/` **wajib** ada unit test (Vitest).
- Komponen kompleks (form, cart, PC builder) wajib punya integration test.
- E2E test (Playwright) untuk critical flow: browse → add to cart → checkout.
- Coverage target: tidak diwajibkan angka, tapi setiap PR yang menambah logic wajib menambah test.

### 9.1 `tsc`, lint, dan build TIDAK cukup untuk komponen interaktif ATAU layout

Empat kasus nyata di project ini, di mana `npx tsc --noEmit`, `npm run lint`, dan `next build` semuanya lolos hijau — tapi fiturnya rusak begitu benar-benar dipakai di browser:

1. **Entri "Akun" hilang dari dock mobile.** Kode-nya valid TypeScript, tidak ada error lint. Hanya kelihatan salah kalau dock-nya dibuka di layar mobile dan slotnya dihitung manual.
2. **Popup Leaflet tertutup elemen lain (z-index).** Style-nya valid CSS, tidak ada warning build. Hanya kelihatan kalau peta benar-benar dirender dan popup-nya diklik.
3. **`AccountNav` melempar runtime error "MenuGroupContext is missing" setiap kali dropdown dibuka** (2026-08-11) — `DropdownMenuLabel` (Base UI `Menu.GroupLabel`) dipakai tanpa pembungkus `Menu.Group`. TypeScript tidak menangkap ini karena secara tipe komponennya valid; error-nya baru terlempar saat `useMenuGroupRootContext()` dipanggil di runtime, persis ketika popup-nya benar-benar ter-mount. Build sukses karena Next.js tidak menjalankan interaksi apa pun saat build, hanya merender pohon komponen sekali secara statis.
4. **Banner "rakitan lama" di `/build-pc` merusak seluruh layout tiga kolom** (2026-08-12) — `basis-full order-first` ditambahkan pada anak baru sebuah container `flex flex-col lg:flex-row` (tanpa `flex-wrap`) dengan asumsi itu akan membuat "pita selebar penuh di baris sendiri" di atas tiga kolom. TypeScript, lint, dan build semuanya valid — className adalah string yang sah, tidak ada yang salah secara tipe. Kenyataannya, tanpa `flex-wrap`, `basis-full` pada sebuah flex-item hanya berarti "ambil 100% lebar di **sumbu utama yang sama**" — item itu tetap berbagi baris horizontal dengan sidebar kiri/kanan yang sudah ada, bukan pindah ke baris sendiri. Hasilnya: kotak besar menimpa kolom sidebar, judul halaman tertutup. Kesalahan ini murni soal *mental model* CSS Flexbox penulis vs kenyataan struktur DOM — sesuatu yang hanya kelihatan kalau layout-nya benar-benar dirender.

**Pola dari keempatnya:** kegagalan yang HANYA terlihat setelah sebuah aksi pengguna (klik, buka menu, geser peta) ATAU setelah layout benar-benar dirender di viewport nyata, tidak akan pernah tertangkap oleh pemeriksaan statis — karena pemeriksaan statis tidak pernah men-trigger aksi itu, dan tidak pernah "melihat" hasil render seperti mata manusia. Verifikasi browser bukan langkah opsional untuk komponen interaktif (dropdown, modal, dock, peta) ATAU untuk perubahan layout (menambah/memindah elemen dalam struktur flex/grid yang sudah ada) — itu satu-satunya cara memastikan komponennya benar-benar berfungsi DAN terlihat benar, bukan cuma valid secara tipe/sintaks.

**Untuk agent (termasuk AI agent) yang tidak punya akses klik manual:** pakai Playwright untuk memicu interaksi itu secara terprogram (klik elemen, baca `console` untuk error React, `page.locator(...).click()` untuk membuka dropdown/modal) — jangan berhenti di "sudah lolos tsc/lint/build, silakan tes sendiri" untuk bug yang jelas-jelas butuh interaksi untuk muncul. Sesi login pelanggan/admin bisa disuntikkan langsung sebagai cookie ke browser context tanpa perlu login manual berulang.

**Untuk perubahan layout secara khusus:** ambil screenshot Playwright **sebelum** menyentuh kode (baseline) di minimal tiga breakpoint (mobile ~375px, tablet ~768px, desktop ~1440px — breakpoint yang relevan dengan komponen yang disentuh), lalu screenshot lagi di ketiganya **setelah** perubahan, dan bandingkan. Ini bukan langkah tambahan opsional — laporan "perubahan layout selesai" tanpa perbandingan sebelum/sesudah di semua breakpoint yang terkena dampak tidak lengkap. Sebelum menambah elemen ke container flex/grid yang sudah ada, periksa dulu `flex-direction` sungguhan di breakpoint yang relevan (lewat `getComputedStyle`, bukan menebak dari className) dan apakah container itu `wrap` — jangan asumsikan struktur dari nama class saja.

---

## 10. Git & Commit

### 10.1 Branch
- `main` — production ready.
- `develop` — integration branch (opsional).
- Feature branch: `feat/nama-fitur`, `fix/nama-bug`, `chore/xxx`.

### 10.2 Commit Message (Conventional Commits)
```
feat(product): add live search suggestion
fix(cart): correct total calculation for variable products
chore(deps): upgrade next to 14.2.0
docs(architecture): clarify server component rules
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`.

### 10.3 PR
- Judul jelas + deskripsi apa yang berubah & kenapa.
- Link ke issue jika ada.
- Screenshot untuk perubahan UI.
- Checklist self-review sebelum request reviewer.

---

## 11. Security

### 11.1 Environment Variable
- Detail di `docs/07-environment-variables.md`.
- Aturan singkat: hanya var yang aman dilihat publik boleh punya prefix `NEXT_PUBLIC_`.

### 11.2 Input Validation
- Semua input dari user (form, URL param, header) **wajib** divalidasi (Zod).
- Jangan trust `searchParams` mentah.

### 11.3 XSS
- Jangan pakai `dangerouslySetInnerHTML` kecuali sangat perlu (misal render HTML dari WordPress).
- Kalau harus, sanitize dulu dengan DOMPurify (server-side).

### 11.4 CSRF
- Route Handler yang mengubah state harus verifikasi origin atau CSRF token.

---

## 12. Performance

### 12.1 Bundle Size
- Cek dampak dependency sebelum install (bundlephobia).
- Dynamic import untuk komponen berat yang tidak selalu terlihat.
- Client Component sekecil mungkin — jangan `"use client"` di root layout.

### 12.2 Image
- **Selalu** pakai `next/image`.
- Set `sizes` yang tepat.
- Prefer WebP/AVIF (Next.js otomatis).

### 12.3 Font
- Pakai `next/font` — self-hosted, tidak ada layout shift.

### 12.4 Core Web Vitals
Target:
- **LCP** < 2.5s.
- **INP** < 200ms.
- **CLS** < 0.1.

Monitoring lewat Vercel Analytics / self-hosted (Umami + Web Vitals).

---

## 13. Aksesibilitas

Rangkuman (detail di `docs/04-component-guidelines.md`):
- Semantic HTML dulu (button untuk button, a untuk link).
- ARIA hanya jika HTML tidak cukup.
- Kontras minimum WCAG AA (4.5:1 text, 3:1 UI).
- Keyboard-navigable.

---

## 14. Ringkasan Aturan Wajib

- ✅ TypeScript strict, no `any`.
- ✅ Konsisten naming.
- ✅ Fungsi kecil, single responsibility.
- ✅ Business logic terpisah dari UI.
- ✅ Import order konsisten.
- ✅ Format otomatis (Prettier + ESLint).
- ✅ Error handling eksplisit.
- ✅ Input validation dengan Zod.
- ✅ Test untuk utility & fitur kompleks.
- ✅ Conventional commit.
- ❌ Tidak boleh commit `console.log`, `TODO` tanpa konteks, atau kode dead-end.
