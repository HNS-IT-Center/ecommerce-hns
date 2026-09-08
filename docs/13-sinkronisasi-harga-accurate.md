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
| Pemetaan bertanda layak dipercaya | 2.068 | `needs_review=0` DAN `confidence_score>=90` |
| — di antaranya menunjuk `woo_product_id = 0` | **1.092** | **produk hantu, lihat §2.1** |
| **Barang Accurate yang benar-benar tertaut** | **976 (13,9%)** | menunjuk produk web yang sungguh ada |
| Produk web punya `sku` | 1.401 (26%) | terlalu kosong untuk jadi kunci |
| Barang Accurate punya `barcode_ean` | 3.562 (51%) | — |
| Produk web punya kolom barcode | **TIDAK ADA** | kolomnya belum pernah dibuat |

**Kesimpulannya: 86% barang Accurate tidak punya kaitan ke produk web.**
Pemetaan yang ada lahir dari pencocokan nama berskor, dan salah pasang berarti
harga produk A pindah ke produk B.

### 2.1 Cacat yang harus dibersihkan lebih dulu: pemetaan ke produk hantu

**1.092 baris di `accurate_woo_mapping` menunjuk `woo_product_id = 0`.** Tidak
ada produk ber-`woo_id` 0 di katalog — angka itu bukan penunjuk ke apa pun,
melainkan nilai kosong yang tertulis sebagai nol.

Yang membuatnya berbahaya: seluruh 1.092 baris itu bertanda `needs_review = 0`
dan `confidence_score = 100`. Menurut ukuran apa pun yang dipakai kode sekarang,
mereka **pemetaan paling tepercaya di seluruh tabel** — dan semuanya menunjuk ke
ketiadaan.

Kekeliruan ini sempat masuk ke versi pertama dokumen ini: angka tertaut ditulis
1.980 (28%), karena `woo_product_id IS NOT NULL` menganggap nol sebagai
penunjuk yang sah. Angka sebenarnya 976, hampir setengahnya.

**Konsekuensinya untuk Fase 1:** jangan mengisi kolom penambat dari
`accurate_woo_mapping` apa adanya. Saring `woo_product_id > 0` **dan** pastikan
produknya benar-benar ada lewat join ke `products` — bukan sekadar percaya pada
skornya.

---

## 3. Keputusan yang sudah diambil

### 3.1 Ruang lingkup: HARGA JUAL DULU, STOK BELAKANGAN

Yang disinkronkan **hanya harga jual (SRP)**. Stok tidak ikut.

Alasannya dari pemilik project: stok disinkronkan dengan **cek fisik di
lapangan**, bukan dari angka Accurate. Angka `Stok Sistem` di ekspor sering jauh
dari kenyataan rak, jadi memindahkannya ke web justru menyesatkan pembeli —
menampilkan "tersedia" untuk barang yang sudah tidak ada lebih buruk daripada
tidak menampilkan apa-apa.

### 3.2 Kode berawalan 2 yang dipakai, bukan yang berawalan 1

**Aturan dari pemilik project:** barang di Accurate punya dua skema kode. Yang
dipakai adalah **yang berawalan `2`**.

Diperiksa terhadap data, dan datanya mendukung dengan jelas:

| | Awalan `1` (6 digit) | Awalan `2` (10 digit) |
|---|---|---|
| Jumlah | 1.474 | 5.517 |
| Ditandai **tidak aktif** (`STATUS = YA`) | **1.052 (71%)** | 51 (0,9%) |
| Punya stok | 157 (11%) | 2.138 (39%) |
| Punya harga jual (`SP`) | **112 (8%)** | **2.188 (40%)** |

Awalan `1` adalah skema lama yang sebagian besar isinya sudah mati: tujuh dari
sepuluh ditandai tidak aktif, dan hanya delapan dari seratus yang punya harga
jual. Awalan `2` yang hidup — 99% aktif, dan empat dari sepuluh berharga.
Kodenya sendiri tampak memuat tahun-bulan (`2507…` = Juli 2025, `2603…` = Maret
2026), yang menjelaskan kenapa ia bertambah terus sementara yang lama tidak.

Dari 976 tautan yang benar-benar sah, **806 (83%) sudah berawalan `2`** — jadi
aturannya bukan pembalikan arah, melainkan penegasan yang sudah berjalan.

**Yang TIDAK terbukti, dan sebaiknya tidak diandalkan:** keterangan awal
menyebut "banyak nama dobel karena ada dua SKU". Di dalam `accurate_products`
hanya ada **7** kelompok nama kembar, dan **nol** di antaranya mencampur awalan
`1` dengan `2` — yang kembar justru dua-duanya berawalan `2` dari bulan berbeda.
Di sisi pemetaan, hanya **6** produk web yang tertaut ke kedua skema sekaligus.

Artinya duplikasi lintas-skema bukan masalah besar dalam data yang kita punya.
Aturan "pakai yang berawalan 2" tetap dipakai, tapi alasannya yang benar adalah
**awalan 1 sudah mati**, bukan karena ada banyak kembaran yang harus dipilih.
Membedakan keduanya penting: kalau nanti ada barang yang HANYA punya kode
berawalan `1` dan masih hidup, ia tidak boleh ikut terbuang.

**Penerapannya:**
- Saat menautkan otomatis, dahulukan kode berawalan `2`.
- Kalau satu produk web tertaut ke kedua skema, **yang berawalan `2` yang
  menang**, dan yang berawalan `1` dilepas.
- Barang berawalan `1` yang masih aktif dan berharga (157 berstok, 112 berharga)
  **tidak dibuang** — ia tetap boleh ditautkan kalau memang tidak ada padanan
  berawalan `2`.

### 3.3 Yang tidak punya harga jual, tidak ikut

**Saringannya satu: barang wajib punya `SP`.** Tidak ada daftar kategori yang
dikecualikan, dan itu disengaja.

Pemilik project menyebut lima kelompok yang tidak perlu disinkronkan — jasa,
PC rakitan pesanan, tas/backpack, sparepart, dan baterai. Diperiksa ke data,
kelimanya ternyata punya satu benang merah:

| Kelompok | Jumlah | Punya `SP` |
|---|---|---|
| JASA | 3 | **0** |
| RAKITAN / SET PC | 42 | **3** |
| Kategori BACKPACK/TAS | 30 | **1** |
| Kategori SPAREPART | 71 | **1** |
| Kategori BATERAI | 56 | **1** |

Dari 202 barang, hanya **6** yang punya harga jual. Itu masuk akal: harga jasa
menyatu dengan servis dan tidak dipisahkan di Accurate; PC rakitan dibuat per
pesanan — namanya bahkan nama pelanggan (`PC RAKITAN BP NANDA`,
`PC RAKITAN HARAPAN BUNDA`, `PC RAKITAN PT WONDER MOBILITAS BATAM`); sparepart
dan baterai dipakai memperbaiki, bukan dijual di web.

Karena yang disinkronkan adalah harga jual, **barang tanpa harga jual tidak
punya apa pun untuk dikirim.** Ia tersaring dengan sendirinya.

**Kenapa bukan daftar kategori:** daftar harus dirawat. Kategori baru yang lupa
didaftarkan akan diam-diam ikut tersinkron, dan tidak ada yang tahu sampai
harganya sudah tampil di web. Saringan "punya harga jual" tidak pernah basi.

Konsekuensi yang diterima: 6 barang dari kelompok di atas yang kebetulan
berharga akan tetap ikut. Kalau suatu saat itu mengganggu, penanda per-barang
lebih tepat daripada memblokir sekategori.

### 3.4 Berapa yang benar-benar bisa disinkronkan hari ini

Saringan di atas ditumpuk berurutan:

| Tahap | Jumlah |
|---|---|
| Semua barang Accurate | 7.041 |
| Punya harga jual (`SP`) | 2.312 |
| + harganya angka wajar (≥ 1.000) | 2.067 |
| **+ tertaut ke produk web yang sungguh ada** | **479** |

**479.** Itu angka yang jujur untuk hari ini, dan ia menunjukkan di mana
hambatannya: bukan di harga — 2.067 barang sudah siap dari sisi harga — melainkan
di **penautan**. Fase 2 yang menentukan, bukan Fase 3.

Selisih 2.312 → 2.067 (245 barang) adalah harga yang angkanya tidak wajar,
seperti `145` untuk barang ratusan ribu. Barang itu **tidak dibuang dan tidak
ditebak** — ia ditandai untuk dilihat manusia, sesuai §5.

### 3.5 Penautan: KOLOM KODE ACCURATE DI PRODUK

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

Isi awalnya dari **976 tautan yang benar-benar sah**, supaya pekerjaan
pencocokan lama tidak dibuang percuma. Saringannya wajib `woo_product_id > 0`
**dan** join ke `products` — bukan sekadar `needs_review=0` dan skor tinggi,
karena 1.092 baris berskor 100 justru menunjuk produk hantu (§2.1). Kalau satu
produk web punya kedua skema kode, ambil yang berawalan `2` (§3.2).

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
