# 04 — Component Guidelines

> Baca dokumen ini sebelum membuat, mengubah, atau memindah komponen UI.
> Tujuan: konsistensi visual, reusability, dan maintainability jangka panjang.

---

## 1. Filosofi Komponen

Tiga aturan utama:

1. **Small & Focused** — 1 komponen = 1 tanggung jawab. Kalau file > 200 baris, kemungkinan besar perlu dipecah.
2. **Composition over Configuration** — lebih baik komponen kecil yang bisa digabung daripada komponen besar dengan puluhan props.
3. **Reuse dulu, bikin baru belakangan** — cek `components/` dan `features/` sebelum menulis komponen baru.

---

## 2. Klasifikasi Komponen

Ada 4 tipe komponen. Tempatkan di folder yang benar sesuai tipenya.

| Tipe | Lokasi | Contoh | Boleh punya business logic? |
|---|---|---|---|
| **UI Primitive** | `src/components/ui/` | Button, Input, Card, Dialog | ❌ Tidak |
| **Layout** | `src/components/layout/` | Header, Footer, Container, Sidebar | ❌ Tidak |
| **Shared** | `src/components/shared/` | PriceTag, StockBadge, WhatsAppButton | ❌ Minimal (formatting saja) |
| **Feature** | `src/features/<fitur>/components/` | ProductCard, CartDrawer, FilterSidebar | ✅ Boleh (khusus fitur) |

**Aturan naik-level:**
- Komponen di `features/` yang mulai dipakai fitur lain → pertimbangkan naik ke `components/shared/`.
- Jangan naikkan terlalu cepat — komponen shared harus benar-benar generic.

---

## 3. Struktur File Komponen

Setiap komponen menempati 1 folder dengan struktur:

```
ProductCard/
├── index.ts              ← re-export (optional, untuk import bersih)
├── ProductCard.tsx       ← komponen utama
├── ProductCard.types.ts  ← type & interface (jika kompleks)
└── ProductCard.test.tsx  ← unit test (jika ada logic)
```

Untuk komponen kecil (< 50 baris, tanpa test), boleh satu file `ProductCard.tsx`.

---

## 4. Aturan TypeScript

### 4.1 Props Selalu Diketik Eksplisit

```tsx
// ✅ BENAR
type ProductCardProps = {
  product: Product;
  variant?: "default" | "compact";
  onAddToCart?: (productId: number) => void;
};

export function ProductCard({ product, variant = "default", onAddToCart }: ProductCardProps) {
  // ...
}

// ❌ SALAH
export function ProductCard(props: any) { ... }
export function ProductCard({ product }) { ... } // implicit any
```

### 4.2 Type vs Interface
- `type` untuk props, union, utility type.
- `interface` untuk objek yang mungkin di-extend (jarang di komponen).
- Konsisten dalam satu file.

### 4.3 Children
- Gunakan `React.ReactNode` untuk children.
- Untuk render prop, tipe fungsi eksplisit.

```tsx
type ContainerProps = {
  children: React.ReactNode;
};

type ListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
};
```

### 4.4 Event Handler
- Gunakan tipe React bawaan: `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>`.

---

## 5. Naming Convention

| Item | Aturan | Contoh |
|---|---|---|
| Nama komponen | PascalCase | `ProductCard` |
| File komponen | PascalCase | `ProductCard.tsx` |
| Nama props type | `<Nama>Props` | `ProductCardProps` |
| Boolean prop | prefix `is/has/should/can` | `isDisabled`, `hasStock` |
| Event handler prop | prefix `on` | `onAddToCart`, `onFilterChange` |
| Event handler internal | prefix `handle` | `handleClick`, `handleSubmit` |
| Hook | prefix `use` | `useProductFilters` |

---

## 6. Pola Composition (Wajib Dipahami)

Untuk komponen yang punya banyak variasi tampilan, gunakan composition, bukan flag props.

### ❌ Anti-Pattern (Flag Props)
```tsx
<ProductCard
  product={product}
  showBadge
  showRating
  showBrand
  compact
  withAddToCart
  withWishlist
/>
```

### ✅ Pola Compound Component
```tsx
<ProductCard product={product}>
  <ProductCard.Image />
  <ProductCard.Badge>Sale</ProductCard.Badge>
  <ProductCard.Info>
    <ProductCard.Brand />
    <ProductCard.Title />
    <ProductCard.Price />
  </ProductCard.Info>
  <ProductCard.Actions>
    <AddToCartButton productId={product.id} />
    <WishlistButton productId={product.id} />
  </ProductCard.Actions>
</ProductCard>
```

Gunakan pola ini untuk komponen kompleks: `ProductCard`, `ProductDetail`, `CartDrawer`, `FilterSidebar`.

---

## 7. Server vs Client Component (Ringkasan)

Detail penuh di `docs/02-architecture.md`. Ringkasan untuk komponen:

- **Default: Server Component** — jangan tambahkan `"use client"` kecuali perlu.
- **Client Component** jika:
  - Ada `useState`, `useEffect`, `useRef`, atau hook lain.
  - Ada event handler onClick/onChange (kecuali diproses lewat `<form action>` Server Action).
  - Pakai browser API (localStorage, window).
  - Pakai Zustand / TanStack Query.

**Pola yang dianjurkan:** wrap interaktivitas kecil di Client Component, biarkan komponen luar tetap Server.

```tsx
// Server Component
export function ProductInfo({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <PriceTag price={product.price} />
      {/* Client Component kecil, tidak mempengaruhi SSR sekitar */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}
```

---

## 8. Responsive Behavior

Setiap komponen **wajib** responsive. Aturan:

### 8.1 Mobile-First
Tulis style default untuk mobile, override untuk layar lebih besar:

```tsx
// ✅ BENAR — mobile first
<div className="flex flex-col gap-4 md:flex-row md:gap-8">

// ❌ SALAH — desktop first
<div className="flex flex-row gap-8 md:flex-col md:gap-4">
```

### 8.2 Breakpoint Standar (Tailwind)
- `sm` : ≥ 640px (mobile besar / phablet)
- `md` : ≥ 768px (tablet portrait)
- `lg` : ≥ 1024px (tablet landscape / laptop kecil)
- `xl` : ≥ 1280px (laptop / desktop)
- `2xl`: ≥ 1536px (desktop besar)

### 8.3 Touch Target
- Tombol minimal **44x44px** untuk touch (aturan Apple HIG & Android Material).
- Jarak antar elemen tap minimal 8px.

### 8.4 Gambar
- Selalu pakai `next/image` dengan `sizes` yang benar.
- Aspect ratio konsisten agar tidak layout shift.

```tsx
<Image
  src={product.image}
  alt={product.name}
  width={400}
  height={400}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
  className="aspect-square object-cover"
/>
```

---

## 9. State Komponen (Loading, Error, Empty)

Komponen yang menampilkan data **wajib** menangani 4 state:

1. **Loading** — skeleton, bukan spinner (kecuali action seperti submit).
2. **Empty** — pesan ramah + CTA (contoh: "Belum ada produk di kategori ini. Lihat kategori lain →").
3. **Error** — pesan jelas + tombol coba lagi / chat CS.
4. **Success** — tampilan normal.

Untuk halaman, gunakan `loading.tsx` dan `error.tsx` Next.js.

---

## 10. Accessibility (WAJIB)

Aturan minimum:

- Semua form input punya `<label>` (tidak boleh placeholder-only).
- Tombol icon-only punya `aria-label`.
- Warna kontras rasio ≥ 4.5:1 untuk text (WCAG AA).
- Focus ring terlihat jelas (jangan hilangkan outline tanpa pengganti).
- Struktur heading berurut (h1 → h2 → h3, jangan lompat).
- Modal & dialog trap focus (pakai Radix / shadcn dialog, jangan bikin dari nol).
- Gambar dekoratif pakai `alt=""`, gambar informatif pakai alt deskriptif.

---

## 11. Styling dengan Tailwind

### 11.1 Aturan Umum
- Tulis class Tailwind langsung di komponen.
- Untuk kombinasi kelas panjang & kondisional, pakai `cn()` (dari `lib/utils`):

```tsx
import { cn } from "@/lib/utils";

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-blue-500 bg-blue-50",
  isDisabled && "opacity-50 cursor-not-allowed",
)}>
```

### 11.2 Larangan
- ❌ Inline style (`style={{ color: "red" }}`) — kecuali nilai dinamis dari data.
- ❌ CSS module baru (tidak konsisten dengan sisa codebase).
- ❌ Class Tailwind yang berulang di banyak tempat tanpa dijadikan komponen.

### 11.3 Design Token
- Warna, spacing, typography **wajib** lewat design token di `tailwind.config.ts`.
- Jangan hardcode warna (`text-[#1f3864]`) — daftarkan sebagai `primary`, `accent`, dsb.

---

## 12. Daftar Komponen Rencana

Daftar komponen ini akan tumbuh seiring waktu. Update file ini saat menambah komponen baru.

### 12.1 UI Primitives (`components/ui/`)
Diambil dari shadcn/ui, di-copy ke repo (ownable):
- `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Switch`.
- `Dialog`, `Sheet`, `Drawer`, `Popover`, `Tooltip`.
- `Card`, `Badge`, `Separator`, `Skeleton`, `Spinner`.
- `Tabs`, `Accordion`, `Table`.
- `Toast` / `Sonner`.

### 12.2 Layout (`components/layout/`)
- `Header` (dengan search, cart icon, wishlist icon, menu mobile).
- `Footer` (payment info, sosmed, quick links, alamat toko).
- `Container` (max-width wrapper).
- `Section` (padding vertical konsisten).
- `MobileMenu`.

### 12.3 Shared (`components/shared/`)
- `PriceTag` — format harga + coret + persentase diskon.
- `StockBadge` — badge stok (Tersedia/Menipis/Habis).
- `WhatsAppButton` — CTA dengan pre-filled pesan.
- `BrandLogo` — logo brand konsisten.
- `Breadcrumb`.
- `EmptyState`.
- `ErrorState`.
- `LoadingSkeleton` variants.

### 12.4 Feature Components (`features/<fitur>/components/`)
- `product/`: `ProductCard`, `ProductGrid`, `ProductGallery`, `ProductInfo`, `ProductVariations`, `RelatedProducts`.
- `cart/`: `CartDrawer`, `CartItem`, `CartSummary`, `AddToCartButton`.
- `wishlist/`: `WishlistButton`, `WishlistGrid`.
- `checkout/`: `CheckoutForm`, `AddressForm`, `PaymentSelector`, `OrderSummary`.
- `search/`: `SearchBar`, `LiveSearchResults`, `SearchPageResults`.
- `filter/`: `FilterSidebar`, `PriceRangeFilter`, `CategoryFilter`, `BrandFilter`, `SortSelector`.
- `pc-builder/`: `BuilderStepList`, `PartSelector`, `CompatibilityWarning`, `BuildSummary`.
- `service-booking/`: `ServiceForm`, `ServiceTypeSelector`.

---

## 13. Checklist Sebelum Merge Komponen

- [ ] Nama komponen jelas & sesuai konvensi.
- [ ] Props diketik eksplisit, tanpa `any`.
- [ ] Server/Client Component sudah tepat.
- [ ] Responsive di mobile, tablet, desktop.
- [ ] Loading, empty, error state ditangani (jika komponen data).
- [ ] Accessible (label, aria, kontras, focus).
- [ ] Tidak duplikasi dengan komponen yang sudah ada.
- [ ] Tidak > 200 baris (kalau iya, pecah).
- [ ] Ada di daftar komponen di file ini (jika komponen shared/feature baru).
