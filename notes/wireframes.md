# Phase 7 — Wireframes (Low-Fidelity)

Dokumen ini memuat rancangan tata letak (wireframe) berformat teks untuk halaman-halaman utama (P0) HNS IT Center. Tujuannya adalah menyepakati *layout*, hierarki, dan posisi komponen sebelum kita mulai menulis kode styling (Tailwind) di Fase 8.

---

## 1. Homepage (`/`)

**Tujuan Layout:** Langsung memperlihatkan otoritas (Trust Indicators) di bagian paling atas (above the fold) bersama dengan promosi utama (Deals/Hero), lalu dilanjutkan dengan *product discovery*.

### Mobile Layout (< 768px)
```text
+--------------------------------------------------+
| [Hamburger]  [Logo HNS]       [Search] [Cart(2)] | <- Header (Sticky)
+--------------------------------------------------+
|                                                  |
|              HERO BANNER (Swipeable)             |
|              [ < ]  [Promo 1]  [ > ]             |
|                o o o (indicators)                |
|                                                  |
+--------------------------------------------------+
|   TRUST INDICATORS (Swipeable horizontally)      |
|  ( ) Harga Terbaik  ( ) Garansi  ( ) Pengiriman  |
+--------------------------------------------------+
| ⏳ DEALS OF THE DAY                 [05:22:10]   |
| +-----------------+  +-----------------+         |
| | [Image]         |  | [Image]         | (Swipe) |
| | Title           |  | Title           |         |
| | Rp 15.000.000   |  | Rp 5.000.000    |         |
| +-----------------+  +-----------------+         |
+--------------------------------------------------+
| NEW ITEMS TABS                                   |
| [ Laptop ]  PC Components  Gaming Gear           |
| +-----------------+  +-----------------+         |
| | Product Card    |  | Product Card    |         |
| +-----------------+  +-----------------+         |
| | Product Card    |  | Product Card    |         |
| +-----------------+  +-----------------+         |
|                 [Lihat Semua]                    |
+--------------------------------------------------+
| BRAND PARTNERS (Auto-scroll)                     |
| [Asus] [MSI] [Acer] [Lenovo] [Logitech]          |
+--------------------------------------------------+
| TOKO FISIK KAMI                                  |
| [ Nagoya Gateway (Map/Alamat) ]                  |
| [ Nagoya Hill (Map/Alamat)    ]                  |
+--------------------------------------------------+
| FOOTER                                           |
| - Info Bank (BCA, Mandiri, BRI)                  |
| - Link: About, Support, Klaim Garansi (SSO)      |
| - Copyright & Social Media Icons                 |
+--------------------------------------------------+
```

### Desktop Layout (≥ 1024px)
```text
+--------------------------------------------------------------------------------+
| [Logo HNS]   [Kategori v]   [Search Bar .....................]   [SSO] [Cart]  |
+--------------------------------------------------------------------------------+
|                                                                                |
|                           HERO BANNER (Large)                                  |
|                                                                                |
+--------------------------------------------------------------------------------+
| [Icon] Harga Terbaik | [Icon] Garansi Resmi | [Icon] Teknisi | [Icon] CS ...   |
+--------------------------------------------------------------------------------+
| ⏳ DEALS OF THE DAY                                            Berakhir: 05:22 |
| [ Product Card 1 ] [ Product Card 2 ] [ Product Card 3 ] [ Product Card 4 ]    |
+--------------------------------------------------------------------------------+
| NEW ITEMS [ Laptop | PC Components | Gaming Gear ]                             |
|                                                                                |
| [ Product Card ]   [ Product Card ]   [ Product Card ]   [ Product Card ]      |
| [ Product Card ]   [ Product Card ]   [ Product Card ]   [ Product Card ]      |
+--------------------------------------------------------------------------------+
| BRAND PARTNERS: [Asus] [MSI] [Acer] [Lenovo] [Logitech] [Razer] [Rexus]        |
+--------------------------------------------------------------------------------+
| TOKO FISIK:  [ Card Nagoya Gateway ]      [ Card Nagoya Hill ]                 |
+--------------------------------------------------------------------------------+
| FOOTER (4 Columns): Perusahaan | Bantuan/SSO | Info Bank | Kontak/Sosmed       |
+--------------------------------------------------------------------------------+
```

---

## 2. Product Detail Page (`/product/[slug]`)

**Tujuan Layout:** Memaksimalkan konversi dengan menempatkan harga, tombol CTA (terutama WA order), dan badge "Harga Member" di area yang paling mudah dijangkau.

### Desktop Layout (Mobile akan di-stack secara vertikal: Gallery -> Info -> Tabs)
```text
+--------------------------------------------------------------------------------+
| Breadcrumb: Beranda > Kategori > Nama Produk                                   |
+--------------------------------------------------------------------------------+
|                                  |                                             |
| +------------------------------+ |  [Brand Logo]                               |
| |                              | |  H1: Nama Produk Lengkap                    |
| |        MAIN IMAGE            | |  SKU: 123456 | Terjual: 50+                 |
| |                              | |  +---------------------------------------+  |
| +------------------------------+ |  | 🔒 Harga Member: Rp 14.500.000        |  |
| | [Thumb1] [Thumb2] [Thumb3]   | |  | Rp 15.000.000 (Harga Normal)          |  |
| +------------------------------+ |  +---------------------------------------+  |
|                                  |  [CTA: Login untuk dapat harga member]      |
|                                  |                                             |
|                                  |  Varian (Jika ada):                         |
|                                  |  RAM: [ 8GB ] [ 16GB ]                      |
|                                  |  Warna: [ Hitam ] [ Putih ]                 |
|                                  |                                             |
|                                  |  Stok: [Badge: Tersedia]                    |
|                                  |                                             |
|                                  |  [ - | 1 | + ]  [ TAMBAH KE KERANJANG ]     |
|                                  |  [ BELI VIA WHATSAPP (Tombol Hijau Besar) ] |
|                                  |                                             |
|                                  |  * Garansi Resmi 2 Tahun                    |
|                                  |  * Gratis Ongkir area Batam                 |
+--------------------------------------------------------------------------------+
|                                                                                |
| TABS: [ DESKRIPSI ]  [ SPESIFIKASI ]  [ REVIEW ]                               |
|                                                                                |
| (Isi tab deskripsi / spek teknis yang panjang)                                 |
|                                                                                |
+--------------------------------------------------------------------------------+
| PRODUK TERKAIT                                                                 |
| [ Product Card ]   [ Product Card ]   [ Product Card ]   [ Product Card ]      |
+--------------------------------------------------------------------------------+
```

---

## 3. PC Builder (`/build-pc`)

**Tujuan Layout:** Memberikan panduan step-by-step yang jelas agar user tidak bingung. Sidebar untuk merangkum harga secara *real-time* sangat krusial.

### Desktop Layout (Split View)
```text
+--------------------------------------------------------------------------------+
| H1: PC Builder Custom                                                          |
| Pilih komponen PC Anda. Sistem kami akan mengecek kompatibilitas dasar.        |
+--------------------------------------------------------------------------------+
| KIRI: DAFTAR SLOT KOMPONEN (70%)         | KANAN: BUILD SUMMARY (30%)          |
|                                          |                                     |
| [1. Prosesor (CPU)]           [ Pilih ]  | ESTIMASI HARGA                      |
|   (Belum dipilih)                        | Rp 0                                |
|                                          |                                     |
| [2. Motherboard]              [ Pilih ]  | DAFTAR PART:                        |
|   (Belum dipilih)                        | - CPU: Kosong                       |
|                                          | - Mobo: Kosong                      |
| [3. RAM / Memory]             [ Pilih ]  | - RAM: Kosong                       |
|   (Belum dipilih)                        | ...                                 |
|                                          |                                     |
| [4. Kartu Grafis (VGA)]       [ Pilih ]  | [ Warning: Pilih CPU & Mobo dulu]   |
|   (Belum dipilih)                        |                                     |
|                                          | [ SIMPAN BUILD ]                    |
| ... dst (Penyimpanan, PSU, Casing)       | [ LANJUT CHECKOUT / WA ] (Disabled) |
+--------------------------------------------------------------------------------+
```

**Saat User klik [ Pilih ] pada Prosesor:**
```text
[ MODAL / SLIDE-OVER MUNCUL DI TENGAH LAYAR ]
+----------------------------------------------------------+
| Pilih Prosesor (CPU)                             [ X ]   |
+----------------------------------------------------------+
| Search...           | Filter: [Intel] [AMD] [Harga]      |
+----------------------------------------------------------+
| [Img] Intel Core i5-12400F      Rp 2.000.000   [ PILIH ] |
| [Img] AMD Ryzen 5 5600X         Rp 2.200.000   [ PILIH ] |
| [Img] Intel Core i7-13700K      Rp 6.500.000   [ PILIH ] |
| ...                                                      |
+----------------------------------------------------------+
```

---

## 4. Shop / Catalog (`/shop`)

**Tujuan Layout:** Filter yang mudah diakses (kiri di desktop, drawer di mobile) dan fokus utama pada grid produk.

### Desktop Layout
```text
+--------------------------------------------------------------------------------+
| H1: Katalog Produk                                                             |
| Home > Semua Produk                                                            |
+--------------------------------------------------------------------------------+
| KIRI: FILTER (25%)                       | KANAN: GRID PRODUK (75%)            |
|                                          |                                     |
| [ Kategori ]                             | Menampilkan 1-12 dari 150 produk    |
| (x) Laptop                               | Urutkan: [ Paling Baru v ]          |
| ( ) Desktop PC                           | ----------------------------------- |
| ( ) PC Components                        |                                     |
|                                          | [ Prod Card ] [ Prod Card ] [ Card ]|
| [ Harga ]                                |                                     |
| Min: [ Rp 0 ]                            | [ Prod Card ] [ Prod Card ] [ Card ]|
| Max: [ Rp 20.000.000 ]                   |                                     |
|                                          | [ Prod Card ] [ Prod Card ] [ Card ]|
| [ Brand ]                                |                                     |
| [ ] Asus                                 | [ Prod Card ] [ Prod Card ] [ Card ]|
| [x] MSI                                  |                                     |
|                                          | ----------------------------------- |
| [ ] Hanya tampilkan Promo                | [ < ] [ 1 ] [ 2 ] [ 3 ] [ > ]       |
+--------------------------------------------------------------------------------+
```
*(Di mobile, bagian "KIRI: FILTER" disembunyikan dalam tombol "Filter (2)" yang memicu bottom sheet/drawer).*
