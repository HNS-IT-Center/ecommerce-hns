# 01 — Business Context

> Baca dokumen ini sebelum memutuskan fitur baru, prioritas, atau copy UI.
> Semua keputusan produk harus konsisten dengan konteks bisnis di sini.

---

## 1. Tentang Bisnis

**Nama:** HNS IT Center Batam
**Legal:** PT. Sentral Berkat Teknologi
**Lokasi fisik:** 2 store di Batam (Nagoya Gateway & Nagoya Hill)
**Website lama:** hnsitcenter.id (WordPress + WooCommerce)
**Model bisnis:** Retail komputer & elektronik dengan penjualan online + offline + layanan servis.

HNS IT Center **BUKAN** marketplace, **BUKAN** dropshipper. Ini adalah retailer dengan stok fisik, tim teknisi sendiri, dan reputasi lokal di Batam. Copywriting dan desain harus mencerminkan hal ini.

---

## 2. Produk yang Dijual

| Kategori | Contoh |
|---|---|
| Desktop PC | PC office, PC workstation, prebuilt PC HNS |
| Gaming PC | PC gaming rakitan, prebuilt gaming |
| Laptop | Laptop office, laptop gaming, ultrabook |
| PC Components | CPU, motherboard, RAM, VGA, SSD, PSU, cooling, casing |
| Gaming Gear | Keyboard, mouse, headset, mousepad, gamepad, kursi gaming |
| Office Equipment | Printer, scanner, UPS, proyektor |
| Networking | Router, switch, access point, kabel jaringan |
| Monitor | Monitor gaming, monitor office, portable monitor |
| Aksesoris | Kabel, adapter, hub, cooling pad |
| Elektronik lain | Sesuai stok toko |

Produk memiliki **variasi** (contoh: RAM 8GB vs 16GB, warna keyboard, dst). Struktur data harus support variasi (WooCommerce Variable Product).

---

## 3. Layanan yang Ditawarkan

Layanan **bukan produk WooCommerce standar** — ini fitur custom yang perlu penanganan tersendiri (booking form, konsultasi, follow-up via WhatsApp CS).

| Layanan | Deskripsi Singkat |
|---|---|
| Rakit PC (Custom PC Builder) | Konfigurator pilih part → checkout / kirim ke WhatsApp |
| Service Laptop & PC | Diagnosis kerusakan, perbaikan hardware/software |
| Upgrade Hardware | Ganti/tambah RAM, SSD, VGA, cooling, dll |
| Instalasi | Instalasi OS, software, jaringan |
| Konsultasi | Rekomendasi spec sesuai kebutuhan & budget |

---

## 4. Target User (Persona)

Empat persona utama yang harus dipertimbangkan setiap kali membuat fitur:

### 4.1 Gamer / PC Enthusiast
- Cari: VGA, prosesor, RAM, motherboard, custom build.
- Perilaku: Riset lama, bandingkan spec, sensitif harga & kompatibilitas.
- Kebutuhan UI: Filter spec detail (chipset, socket, memory), fitur Rakit PC, review, spec comparison.

### 4.2 Pekerja Kantor / Mahasiswa
- Cari: Laptop, printer, aksesoris.
- Perilaku: Cepat, tidak mau ribet, penting warranty & after sales.
- Kebutuhan UI: Rekomendasi paket, filter budget, garansi jelas, checkout cepat.

### 4.3 Pemilik Bisnis / Warnet / Kantor Kecil
- Cari: Multiple unit PC, networking, printer, service.
- Perilaku: Butuh konsultasi & penawaran, transaksi lebih besar.
- Kebutuhan UI: Kontak CS mudah, form request penawaran, katalog jelas, halaman B2B/wholesale (bisa Fase 2).

### 4.4 Customer Service Butuh Bantuan
- Cari: Halaman klaim garansi, kontak service.
- Perilaku: Sedang bermasalah, mudah frustrasi.
- Kebutuhan UI: Halaman support jelas, WhatsApp CS 1 klik, informasi warranty transparan.

---

## 5. Value Proposition (Nilai Jual)

Tampilkan konsisten di homepage & touchpoint kunci:

- **Best Deals** — Harga kompetitif dengan pembanding transparan.
- **Safe Shipping** — Pengiriman aman ke seluruh Batam & Indonesia.
- **Official Warranty** — Semua produk bergaransi resmi distributor.
- **Customer Service Responsif** — WhatsApp CS aktif.
- **After Sales** — Bantuan jika barang bermasalah.
- **Professional Technician** — Ditangani teknisi berpengalaman.

---

## 6. Aturan Data Produk (SANGAT PENTING)

- Data produk (nama, harga, stok, kategori, brand, gambar, deskripsi, variasi, meta SEO) **DIAMBIL dari WooCommerce REST API**.
- **DILARANG:**
  - Menyimpan data produk permanen di database Next.js.
  - Membuat seed / mock data produk permanen di repo.
  - Meng-hardcode SKU, harga, atau spec produk.
- Diperbolehkan:
  - Cache layer (Redis / Next.js Data Cache) dengan revalidation.
  - Index terpisah untuk search engine (Meilisearch/Algolia) yang di-sync dari WooCommerce.
  - Mock data khusus test/Storybook dengan label eksplisit `__mocks__` atau `.mock.ts`.

---

## 7. Aturan Bisnis Non-Teknis

### 7.1 Harga
- Ditampilkan dalam Rupiah dengan pemisah ribuan (misal `Rp 15.000.000`).
- Jika ada harga coret (sale), tampilkan harga asli + harga sekarang + persentase diskon.
- Harga jual = harga di WooCommerce, jangan hitung ulang di frontend.

### 7.2 Stok
- Tampilkan indikator stok: `Tersedia`, `Stok Menipis`, `Habis`.
- Jangan tampilkan angka pasti stok (bisa disalahgunakan kompetitor), kecuali user sudah checkout.
- Produk habis tetap ditampilkan (SEO), dengan CTA `Notify me` atau `Chat CS`.

### 7.3 Alur Beli
Ada 3 alur pembelian paralel yang harus semuanya didukung:

1. **Checkout online** — cart → checkout → payment (Midtrans/Xendit).
2. **WhatsApp order** — tombol "Beli via WhatsApp" langsung dengan pre-filled pesan berisi nama produk & harga.
3. **Datang ke toko** — halaman produk jelas mencantumkan bahwa produk tersedia di store fisik.

### 7.4 Garansi & After Sales
- Setiap produk harus punya field/badge "Garansi Resmi X Tahun" jika tersedia.
- Halaman "Claim & Support" mudah diakses dari header/footer.

---

## 8. Prioritas Fitur (High-Level)

Detail lengkap Phase 1–8 (feature list, sitemap, wireframe, dll) akan dibuat terpisah lewat proses diskusi produk. Sebagai panduan awal:

**P0 (Must Have — dibutuhkan agar website bisa go-live):**
- Katalog produk (list, filter, search, detail).
- Cart & checkout online.
- WhatsApp order integration.
- Halaman kategori & brand.
- Halaman blog (migrasi konten lama).
- Halaman toko fisik + Google Maps.
- Halaman claim & support.
- SEO 1:1 dengan situs lama (slug, meta, redirect).

**P1 (Should Have — bisa menyusul di iterasi kedua):**
- Custom PC Builder.
- Booking service form.
- User account (order history, wishlist).
- Product comparison.
- Notifikasi stok tersedia.

**P2 (Nice to Have — jangka panjang):**
- Program loyalitas / poin.
- Live chat native (bukan hanya WA).
- B2B / wholesale portal.
- Multi-bahasa (EN/ID).
- App mobile.

Prioritas ini **BUKAN** absolut — kalibrasi ulang dengan user sebelum implementasi.
