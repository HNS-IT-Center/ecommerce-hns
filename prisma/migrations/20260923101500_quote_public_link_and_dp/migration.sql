-- Tautan publik quotation (`/q/<token>`) + penanda DP.
--
-- ============================================================================
-- KEPUTUSAN 1 — kenapa tautan publik memakai token acak, bukan `code`
-- ============================================================================
-- `/build-pc/print?kode=…` sudah publik sejak dulu: tidak dijaga src/proxy.ts,
-- tidak minta login, dan menampilkan nama pelanggan beserta seluruh harganya.
-- Selama kodenya hash acak (`HNSPC-260804-7K3M`) itu bisa ditolerir — tidak ada
-- yang bisa menebak dokumen orang lain.
--
-- Sejak 21 September 2026 kodenya NOMOR URUT (`HNSPC-20260921-0001`). Siapa pun
-- yang memegang satu alamat bisa menaik-turunkan angka terakhirnya dan membaca
-- penawaran seisi bulan itu. Selama tautannya tidak pernah disebarkan, celah itu
-- tidur; begitu sales mulai mengirim tautan lewat WhatsApp, ia bangun.
--
-- Karena itu tautan yang disebarkan TIDAK memakai `code`. `public_token` acak 8
-- karakter (≈40 bit) tidak menyimpan hubungan apa pun dengan tetangganya, jadi
-- satu tautan yang bocor tetap satu dokumen yang bocor.
--
-- ============================================================================
-- KEPUTUSAN 2 — kenapa DP BUKAN nilai `status`
-- ============================================================================
-- Rancangan pertama menambahkan `status = 'dp'` di antara 'terbit' dan
-- 'closing'. Itu salah baca terhadap apa yang dikunci: harga sudah terkunci
-- sejak quotation disimpan — `items` adalah snapshot, dan tidak ada satu pun
-- jalur yang memutakhirkannya sendiri. DP tidak mengunci apa pun; ia PENANDA.
--
-- Kalau DP jadi nilai status, setiap penjaga yang berbunyi `status = 'terbit'`
-- ikut menolaknya: syarat revisi di `getQuotationForRevision`, WHERE di
-- `reviseQuotation`, dan `markQuotationClosed`. Akibatnya quotation yang sudah
-- DP tidak bisa direvisi dan tidak bisa ditandai terjual — persis kebalikan
-- dari yang dibutuhkan, karena pelanggan yang sudah membayar DP justru yang
-- paling sering menambah satu komponen lagi sebelum barangnya dirakit.
--
-- Karena itu DP hidup di kolomnya sendiri dan tidak menyentuh `status` sama
-- sekali. Ia juga tidak dicatat di `pc_build_quote_status_logs`: tabel itu ada
-- untuk perubahan yang mengubah angka penjualan seseorang, dan menandai DP
-- tidak mengubah angka siapa pun. Siapa & kapan sudah terjawab `dp_by_user_id`
-- dan `dp_at`.
--
-- ============================================================================
-- YANG SENGAJA TIDAK ADA DI BERKAS INI
-- ============================================================================
-- 1. `DROP TABLE accurate_products` / `accurate_woo_mapping` — dua tabel itu
--    hidup dan dipakai, hanya dikelola lewat SQL mentah sehingga `migrate diff`
--    selalu mengusulkan membuangnya (docs/17 §11.3). Jangan pernah ikut.
-- 2. Backfill `public_token` untuk baris lama. Nilainya harus acak per baris,
--    dan `RAND()` di MariaDB bukan sumber acak yang pantas dipakai untuk
--    alamat yang tidak boleh ditebak. Backfill-nya ada di
--    `scripts/backfill-quote-tokens.ts`, dijalankan sekali setelah migrasi ini.
--    Sampai ia jalan, baris lama ber-token NULL dan halaman yang membutuhkannya
--    menyembunyikan tautannya — bukan gagal.

ALTER TABLE `pc_build_quotes`
  ADD COLUMN `public_token` VARCHAR(16) NULL,
  ADD COLUMN `dp_at` DATETIME(3) NULL,
  ADD COLUMN `dp_by_user_id` VARCHAR(191) NULL;

-- Unik supaya dua quotation mustahil berbagi tautan. MariaDB mengizinkan banyak
-- NULL pada unique index, jadi seluruh baris lama yang belum di-backfill tetap
-- sah dan tidak saling bentrok.
CREATE UNIQUE INDEX `pc_build_quotes_public_token_key` ON `pc_build_quotes`(`public_token`);

-- `SET NULL`, sama seperti `closed_by_user_id`: akun sales yang dihapus tidak
-- boleh membawa serta quotation pelanggannya.
ALTER TABLE `pc_build_quotes`
  ADD CONSTRAINT `pc_build_quotes_dp_by_user_id_fkey`
  FOREIGN KEY (`dp_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
