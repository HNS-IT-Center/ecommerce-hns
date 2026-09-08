# 13. Sinkronisasi Harga Accurate → Web

> **Status: BRIEF — belum ada kode.** Disusun 8 September 2026 setelah keputusan
> ruang lingkup dari pemilik project. Baca ini sebelum menyentuh pencocokan
> barang Accurate ↔ produk web.

---

## 1. Masalah yang sedang dipecahkan

Database Accurate yang dipakai kasir **tidak terhubung** ke web. Tidak ada API,
tidak ada replikasi — jembatannya ekspor manual harian: barang baru datang ke
toko → ekspor dari Accurate → impor ke sistem lewat **Import Data Sheet** di
`/admin/harga-accurate` (sudah jalan, mengisi tabel `accurate_products`).

Yang belum ada: **cara memindahkan harga jual dari barang Accurate ke produk
web yang bersangkutan.** Dan penghalangnya bukan mekanisme pemindahannya,
melainkan pertanyaan yang lebih mendasar — *barang Accurate ini produk web yang
mana?*

---

## 2. Keadaan data (diukur 8 September 2026)

| | Jumlah | Catatan |
|---|---|---|
| Barang di `accurate_products` | **7.041** | dari ekspor harian |
| Produk di `products` (web) | **5.415** | katalog |
| Baris di `accurate_woo_mapping` | 4.707 | pemetaan hasil pencocokan lama |
| Pemetaan **layak dipercaya** | **2.068** | `needs_review=0` DAN `confidence_score>=90` |
| Barang Accurate yang benar-benar tertaut | **1.980 (28%)** | inilah angka yang penting |
| Produk web punya `sku` | 1.401 (26%) | terlalu kosong untuk jadi kunci |
| Barang Accurate punya `barcode_ean` | 3.562 (51%) | — |
| Produk web punya kolom barcode | **TIDAK ADA** | kolomnya belum pernah dibuat |

**Kesimpulannya: 72% barang Accurate tidak punya kaitan tepercaya ke produk
web.** Pemetaan yang ada lahir dari pencocokan nama berskor, dan lebih dari
separuhnya ditandai perlu ditinjau — memang tidak layak dipakai memindahkan
harga, karena salah pasang berarti harga produk A pindah ke produk B.

---

## 3. Keputusan yang sudah diambil

### 3.1 Ruang lingkup: HARGA JUAL DULU, STOK BELAKANGAN

Yang disinkronkan **hanya harga jual (SRP)**. Stok tidak ikut.

Alasannya dari pemilik project: stok disinkronkan dengan **cek fisik di
lapangan**, bukan dari angka Accurate. Angka `Stok Sistem` di ekspor sering jauh
dari kenyataan rak, jadi memindahkannya ke web justru menyesatkan pembeli —
menampilkan "tersedia" untuk barang yang sudah tidak ada lebih buruk daripada
tidak menampilkan apa-apa.

### 3.2 Penautan: KOLOM KODE ACCURATE DI PRODUK

Tabel `products` mendapat kolom baru berisi kode Accurate barang itu. Sekali
ditautkan, tautannya tepat selamanya — tidak ada pencocokan ulang berdasarkan
kemiripan nama, tidak ada skor kepercayaan yang harus ditafsirkan.

Ini juga yang dimaksud pemilik project sejak awal: *"kalo misalkan di upload dia
masukkan kode accurate itu dia enggak usah pairing ulang"*.

**Kenapa bukan yang lain:**
- **`sku`** — cuma 26% produk web mengisinya. Kunci yang tiga perempatnya kosong
  bukan kunci.
- **`barcode`** — 51% barang Accurate punya, tapi produk web **tidak punya
  kolomnya sama sekali**. Memakai jalur ini berarti menambah kolom DAN mengisi
  5.415 baris, dengan hasil akhir tetap di bawah cakupan kode Accurate.
- **Kemiripan nama** — sudah dicoba, hasilnya `accurate_woo_mapping` yang 56%
  isinya perlu ditinjau manusia.

---

## 4. Rencana bertahap

### Fase 1 — Kolom penambat

Tambah kolom kode Accurate di `products`, unik dan nullable (mayoritas produk
belum tertaut, dan itu keadaan normal, bukan galat).

Lewat prosedur `docs/08` — **`migrate dev` dan `db push` dua-duanya dilarang.**
Tulis `migration.sql`-nya, baca SQL-nya, baru `migrate deploy`.

Isi awalnya dari 1.980 pemetaan yang sudah tepercaya, supaya pekerjaan
pencocokan lama tidak dibuang percuma.

### Fase 2 — Layar penautan

Tempat staff menautkan barang Accurate yang belum punya pasangan. Bentuk yang
diusulkan: daftar barang Accurate belum tertaut, dengan pencarian produk web di
sebelahnya, dan tombol pasangkan.

Ini pekerjaan mencicil — 5.061 barang tidak akan selesai dalam sehari, dan tidak
perlu. Barang yang paling sering terjual ditautkan lebih dulu.

**Usul yang perlu dipertimbangkan:** letakkan juga kolom kode Accurate di
formulir produk (`/admin/produk`), supaya barang baru ditautkan saat dibuat —
bukan sebagai pekerjaan susulan. Itu satu-satunya cara jumlah yang belum
tertaut berhenti bertambah.

### Fase 3 — Penerapan harga

Setelah penambatnya ada, penerapan harga tinggal mengikuti tautan yang pasti,
bukan skor kepercayaan.

**Tab Sinkronisasi yang sudah ada TIDAK dibuang.** Pola pratinjau → centang →
terapkan itu justru fitur keselamatan, bukan keterbatasan — lihat §5.

---

## 5. Yang harus dijaga (CLAUDE.md §2.7)

Harga jual adalah **harga yang dilihat pelanggan**. Semua yang di bawah ini
bukan selera, melainkan syarat:

- **Penerapan harga TIDAK BOLEH otomatis tanpa persetujuan manusia.** Satu
  ekspor Accurate yang cacat — kolom bergeser, angka ribuan terpotong — akan
  mengubah ribuan harga sekaligus, dan pembeli melihatnya sebelum ada yang
  sempat sadar. Pratinjau lalu pilih adalah pagarnya.
- **Angka mencurigakan tetap ditandai, bukan dikoreksi diam-diam.**
  `parseHargaAccurate` sudah menolak menebak: harga `145` untuk barang ratusan
  ribu diberi catatan, tidak dikalikan seribu. Jangan "perbaiki" itu.
- **Penerapan wajib lewat `updateProductPriceAction`**, bukan tulis langsung ke
  tabel. Jalur itu sudah punya audit log (`product_logs`), revalidate, dan cek
  izin. Jalur kedua berarti dua jalur harga yang cepat atau lambat berselisih.
- **Harga modal (CP) & dealer tidak pernah ikut ke web.** Keduanya internal, dan
  sejak 7 Sep 2026 modal bahkan punya izin sendiri (`harga-modal`).

---

## 6. Yang masih terbuka

- **Siapa yang berwenang atas SRP kalau Accurate dan web berbeda?** Sejauh ini
  SRP ditetapkan PIC di Accurate lalu mengalir ke web. Perlu ditegaskan apa yang
  terjadi kalau seseorang mengubah harga di panel web setelah sinkronisasi —
  apakah sinkronisasi berikutnya menimpanya kembali?
- **Barang Accurate yang tidak punya produk web sama sekali** — dibiarkan, atau
  suatu saat dibuatkan produk draft? Pemilik project belum memutuskan; untuk
  sekarang di luar ruang lingkup.
- **Seberapa sering sinkronisasi dijalankan** — tiap impor, atau saat staff
  memintanya?

---

## 7. Rujukan

- `docs/08-database-migrations.md` — prosedur wajib untuk Fase 1
- `docs/12-kendala-terbuka.md` — kendala sinkronisasi WooCommerce yang masih ada
- `src/lib/api/accurate/` — impor Sheet, akses `accurate_products`
- `src/lib/services/accurate-price.ts` — pratinjau harga yang sudah berjalan
- CLAUDE.md §2.2 (Prisma sumber tunggal produk) & §2.7 (aturan harga)
