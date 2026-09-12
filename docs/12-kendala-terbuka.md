# Kendala Terbuka — Sinkronisasi WooCommerce

> Dicatat 29 Agustus 2026, setelah fitur sinkronisasi WooCommerce selesai dan
> ter-push ke `team` dan `development` (commit `727cd73`).
>
> Berkas ini **ikut git**, bukan catatan lokal. Alasannya sama dengan yang
> tertulis di pembuka `CLAUDE.md` dan `docs/10`: pekerjaan yang menunggu
> dikerjakan orang lain tidak boleh hanya hidup di satu laptop.
>
> Hapus baris yang sudah beres — jangan biarkan daftar ini jadi arsip.

---

## 1. Kunci REST API WooCommerce perlu dicabut — BELUM SELESAI

**Siapa:** siapa pun yang pegang wp-admin hnsitcenter.id.

Kunci consumer key/secret WooCommerce pernah ditulis sebagai nilai cadangan
hardcoded di tiga skrip uji (`scripts/test-images{,-2,-3}.mjs`), dan kuncinya
**sama persis** dengan yang masih dipakai aplikasi. Skripnya sudah dibuang dari
repo pada commit `727cd73`.

**Membuangnya dari kode tidak membuangnya dari riwayat git.** Kunci itu masih
terbaca di commit `4e9428e` oleh siapa pun yang bisa mengakses repo, dan riwayat
sengaja tidak di-rewrite.

Satu-satunya perbaikan yang sesungguhnya:

1. wp-admin → WooCommerce → Settings → Advanced → REST API → cabut kunci lama,
   terbitkan yang baru.
2. Perbarui `WOOCOMMERCE_CONSUMER_KEY` / `WOOCOMMERCE_CONSUMER_SECRET` di
   `.env.local` **dan** environment deployment.

Kunci itu memberi akses baca-tulis ke seluruh katalog. Selama belum dicabut, ia
masih hidup.

---

## 2. Berkas gambar belum ada di host media

**Siapa:** MrPrasetyo (pemegang sinkronisasi media).

Sejak commit `b397599`, seluruh 13.707 baris `product_images` menunjuk ke
`media.hnsitcenter.com` — termasuk 875 baris milik 170 produk hasil import.

Tapi **berkas unggahan 2026/08 ke atas belum ada di host itu**. Diuji pada 4
berkas dengan dua bentuk path: host media menjawab **404**, sementara URL
WordPress aslinya menjawab **200**. Host media hanya memuat berkas lama.

Akibatnya: **gambar 170 produk baru kosong** sampai berkasnya menyusul.

Keputusan ini diambil sadar — lebih baik katalog menunjuk satu host dan menunggu
berkasnya, daripada bercabang jadi dua host yang harus dijaga selamanya.
Pemetaannya: `/wp-content/uploads/2026/08/x.webp` → `/2026/08/x.webp` (host
media memangkas `/wp-content/uploads`).

Tidak ada yang perlu diubah di aplikasi setelah berkasnya ada — URL-nya sudah
benar.

---

## 3. Varian belum tercakup sinkronisasi

**Siapa:** dev.

Dua celah, keduanya berakar pada hal yang sama: endpoint `/products` WooCommerce
**tidak pernah mengembalikan varian**, hanya daftar id-nya.

- **166 varian** milik induk yang sudah lama ada di katalog belum tertarik.
  Diukur terhadap dump WooCommerce 28 Agustus: dari 166 entri yang belum ada di
  kita, **nol induk, seluruhnya varian**.
- **Harga varian** belum ikut disinkronkan. Perbandingan harga hanya menyentuh
  produk induk, dan induk variable sengaja dilewati karena tidak punya harga
  sendiri di WooCommerce (lihat `docs/05`, bagian jebakan pertama).

Keduanya tertutup oleh satu pekerjaan yang sama: menyusuri **844 induk variable**
dan mengambil `/products/{id}/variations` masing-masing — varian yang belum ada
dibuat, harga yang berbeda dilaporkan seperti harga biasa.

Ongkosnya ±844 permintaan HTTP, sekitar 3–5 menit sekali jalan. Karena itu bukan
bagian dari pratinjau harian, melainkan tombol terpisah ("Sapuan Penuh").

---

## 4. Rapikan-rapikan

**Siapa:** dev.

- **Filter "Tanpa kategori" di `/admin/produk`.** Penyaring yang ada hanya
  status, tipe, dan stok. Tujuh produk hasil import turun jadi draft karena
  kategorinya tidak ketemu, dan sekarang bercampur dengan draft lain tanpa cara
  menyaringnya. Pada sinkronisasi berikutnya mereka **tidak akan** diingatkan
  lagi — statusnya sudah "ada di katalog kita".
- **7 error ESLint** di tiga berkas lama yang tidak tersentuh pekerjaan ini:
  `scripts/import-csv.ts` (2× `no-explicit-any`),
  `features/builder/components/dynamic-builder-view.tsx` (3× `setState` sinkron
  di dalam effect — ini menyentuh perilaku, periksa hati-hati),
  `features/search/components/search-results-dropdown.tsx` (2× tanda kutip belum
  di-escape). `npm run build` tetap lolos, tapi `CLAUDE.md` §5 mensyaratkan lint
  bersih untuk commit.
- **`NEXT_PUBLIC_IMAGE_DOMAIN` adalah kode mati.** Dideklarasikan di
  `config/env.ts`, tidak dibaca satu berkas pun, dan isinya masih host WordPress
  lama. Jangan membangun di atasnya sebelum dibereskan.

---

## 5. `CLAUDE.md` §2.2 sudah tidak akurat

**Siapa:** pemilik project (perubahan pada konstitusi butuh persetujuannya).

§2.2 menyatakan staff sudah 100% pindah ke panel admin baru dan wp-admin
WooCommerce lama tidak dipakai lagi untuk edit produk. **Data dari 28–29 Agustus
2026 menunjukkan sebaliknya:**

- Produk terakhir di WooCommerce dimodifikasi pada hari yang sama saat fitur ini
  dibangun.
- 170 produk lahir di sana setelah katalog kita diimpor.
- 489 harga sudah berbeda antara kedua sistem.

Justru itulah sebabnya fitur sinkronisasi ini ada. Pembuka `CLAUDE.md` sendiri
memperingatkan bahwa aturan usang adalah yang memicu insiden — dan orang
berikutnya yang membaca §2.2 akan bingung menemukan satu fitur penuh yang
bertentangan dengannya.

Satu paragraf perlu diperbarui. Belum dikerjakan karena mengubah konstitusi
project bukan keputusan sepihak.
