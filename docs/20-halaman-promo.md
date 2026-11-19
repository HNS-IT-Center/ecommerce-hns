# 20 — Halaman Promo (`/promo/<slug>`)

> Ditambahkan 19 November 2026. Baca sebelum menyentuh `/promo`, tab
> **Halaman Promo** di `/admin/banner`, `lib/api/promos.ts`, atau tabel
> `promos` / `promo_products`.

Banner beranda dulu hanya bisa menaut alamat bebas (`ctaHref`), dan banner mode
**Gambar Saja** — yang dipakai hampir semua banner HNS — tidak bisa diklik sama
sekali. Sekarang sebuah banner bisa menaut **halaman promo**: halaman berisi
banner itu sendiri, hitung mundur, durasi promo, dan daftar produk pilihan staff.

---

## 1. Aturan yang tidak boleh dilanggar

### Promo tidak menyimpan harga (CLAUDE.md §2.7)

`promos` hanya menyimpan judul, slug, deskripsi, syarat, dan **jadwal**.
`promo_products` hanya keanggotaan (`promo_id`, `product_id`, `sort_order`).
Tidak ada kolom harga, potongan, atau persen.

Kartu di halaman promo adalah `ProductCard` biasa, dan harganya dibaca lewat
`getPublishedProductsByIds()` — jalur yang sama dengan katalog
(`prismaProductToWoo` + `decodeProduct`, termasuk masa berlaku obral). Harga di
halaman promo = harga di halaman produk = harga di keranjang.

Akibatnya **jadwal promo tidak pernah mengubah harga**. Yang mengatur diskon
tetap `salePrice` + `saleEndDate` per produk. Jadwal promo hanya menentukan:

- status halaman: belum mulai / berlangsung / berakhir;
- hitung mundur dan timeline durasi;
- `noindex` untuk promo yang sudah berakhir.

Pemilih produk di admin memberi lencana **"Belum diskon"** pada produk yang
tidak sedang obral di katalog, supaya staff tahu produk itu akan tampil dengan
harga normal. Syarat "sedang obral" di sana sama dengan filter `onSale` di
`buildPrismaWhere`.

### Jangan tambahkan "harga promo" di kemudian hari

Kalau suatu saat dibutuhkan harga yang hanya berlaku di dalam promo, ia harus
datang dari katalog sebagai data dan berlaku di SEMUA jalur (halaman produk,
keranjang, checkout WhatsApp, PDF quotation). Jangan pernah menghitungnya di
komponen promo.

---

## 2. Data

| Tabel | Isi | Hapus |
|---|---|---|
| `promos` | judul, `slug` unik, deskripsi, syarat (satu butir per baris), `is_active`, `starts_at`, `ends_at` | **soft delete** (`deleted_at`) — data operasional HNS (§2.8) |
| `promo_products` | `promo_id`, `product_id`, `sort_order` | ikut terhapus kalau produk atau promonya dihapus permanen (Cascade) |
| `promo_banners.promo_id` | banner → promo, nullable | `SetNull` |

Migrasi: `prisma/migrations/20261119062246_add_promo_pages`. Ditulis tangan
dari `migrate diff` — diff terhadap DB lokal ikut membawa `DROP TABLE` untuk
dua tabel sisa skema lama, dan keduanya dibuang (docs/08 §3).

**Slug unik termasuk milik promo yang sudah dihapus.** Indeks unik tidak
mengenal `deleted_at`, jadi alamat promo lama tidak bisa dipakai ulang. Galat
P2002 diterjemahkan jadi pesan "alamat sudah dipakai" di formulir.

### Gambar header

Halaman promo tidak punya gambar sendiri. Header-nya adalah gambar banner
pertama (urutan beranda) yang menautnya — supaya yang dilihat pengunjung
setelah mengeklik adalah banner yang sama persis. Status tayang banner tidak
disaring di sini: promo yang sudah berakhir tetap menampilkan banner yang dulu
diklik orang, digambar abu-abu dengan cap "PROMO BERAKHIR". Tanpa banner, header
jatuh ke panel warna berisi judul.

---

## 3. Lapisan kode

| Berkas | Isinya |
|---|---|
| `lib/api/promos.ts` | baca publik (`getPromoBySlug`, `getPromoProducts`, `getLivePromos`) + CRUD admin |
| `lib/utils/promo.ts` | murni, aman untuk klien: `promoPhase`, `slugifyPromo`, `parsePromoTerms`, `formatPromoDate` (WIB dipatok) |
| `lib/api/woocommerce/products.ts` → `getPublishedProductsByIds` | produk terbit berdasarkan `products.id`, urutan dipertahankan |
| `app/admin/(panel)/banner/promo-*.tsx` | daftar, formulir, pemilih produk, server action |
| `app/promo/[slug]/page.tsx`, `app/promo/page.tsx` | halaman publik |
| `features/promo/components/*` | hero, kartu info, hitung mundur, grid produk, deretan promo lain |
| `hooks/use-now.ts` | jam bersama tiap detik (`useSyncExternalStore`) |

### Cache

- `getPromoBySlug` dan `getLivePromos` memakai `unstable_cache` dengan tag
  `promos`. Status jadwal dihitung **di luar** cache, alasannya sama dengan
  `getActiveBanners` (docs/05 §15).
- Produk memakai tag `products`, jadi ikut segar setiap kali produk disunting.
- Aksi promo membersihkan tag `promos` **dan** `promo-banners` (banner membaca
  slug promonya lewat relasi). Aksi banner juga membersihkan `promos`, karena
  gambar header promo berasal dari banner.

### Status di klien

`PromoSchedule` memakai `useNow()`. Saat render server dan hidrasi pertama, jam
belum diketahui (`null`), jadi status yang dipakai adalah `initialPhase` dari
server dan kotak hitung mundur berisi `--`. Begitu jam melewati batas
mulai/berakhir, komponen memanggil `router.refresh()` **sekali** supaya bagian
yang dirender server (status, pemberitahuan) ikut berganti.

---

## 4. Banner → promo

`getActiveBanners()` sekarang mengembalikan `href` yang sudah diputuskan:

- banner menaut promo yang **aktif dan belum dihapus** → `/promo/<slug>`,
  dan `linksToPromo: true`;
- selain itu → `ctaHref` seperti sebelumnya.

Di carousel, hanya slide dengan `linksToPromo` yang bisa diklik di **seluruh
area**-nya (link `absolute inset-0`). `ctaHref` biasa sengaja tidak
diperlakukan begitu: banner Gambar Saja lama bisa menyimpan link tombol yang
tidak pernah tampil, dan link itu tidak boleh tiba-tiba hidup. Teks overlay
mode Gambar + Teks dibuat `pointer-events-none` (kecuali tombol CTA) supaya
tidak menghalangi klik.

Promo yang sudah berakhir tetap ditaut — halamannya menjelaskan bahwa promonya
selesai dan menunjuk promo lain. Promo nonaktif/dihapus tidak ditaut, karena
halamannya 404.

---

## 5. Izin

Promo memakai izin **`banner`** (halaman `requirePageView("banner")`, aksi
`requirePermission("banner", "edit")`). Promo baru berarti sesuatu kalau
ditaut banner, dan staff yang menyusun banner adalah yang menyusun isinya. Izin
terpisah hanya membuka keadaan "boleh membuat promo tapi tidak bisa
memasangnya".

---

## 6. SEO

- `alternates.canonical` per halaman: `/promo/<slug>`.
- Promo berakhir: `robots: { index: false }` — tetap bisa dibuka dari tautan
  WhatsApp lama.
- `sitemap.ts` memuat `/promo` dan promo yang **sedang berlangsung** saja.
