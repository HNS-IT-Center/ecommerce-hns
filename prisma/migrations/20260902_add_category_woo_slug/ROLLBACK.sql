-- Pembatalan untuk 20260902_add_category_woo_slug.
--
-- Ditulis SEBELUM migration diterapkan, bukan sesudah — saat rollback
-- dibutuhkan, keadaannya sudah tidak nyaman untuk menyusun SQL dari nol.
--
-- Aman dijalankan: migration-nya aditif murni (satu kolom nullable + satu
-- indeks), jadi membatalkannya hanya membuang apa yang ia tambahkan. Tidak ada
-- baris data lama yang ikut hilang.
--
-- Yang HILANG kalau ini dijalankan: isi kolom woo_slug kategori, yaitu peta 301
-- untuk 107 alamat kategori lama (90 NAMA COCOK + 17 BRAND). Peta itu bisa
-- dibangun ulang dari WooCommerce API selama situs lama masih hidup —
-- endpoint /wp-json/wc/v3/products/categories terbukti dapat diakses
-- 2 September 2026 dan mengembalikan 154 kategori beserta kolom `parent`.
--
-- Setelah 13 September situs itu mati. Sejak saat itu, jalankan ini HANYA
-- kalau petanya sudah dicadangkan (lihat scratch/peta-kategori-2sep.json).
--
-- Nama indeks WAJIB sama dengan yang dibuat migration.sql
-- (`categories_woo_slug_key`, konvensi Prisma untuk UNIQUE). Salah nama =
-- rollback gagal di pernyataan pertama.
--
-- Urutan sengaja: indeks dibuang dulu, baru kolomnya. MariaDB sebenarnya ikut
-- membuang indeks saat kolomnya di-DROP, tapi menuliskannya eksplisit membuat
-- maksudnya terbaca dan tidak bergantung pada perilaku itu.

DROP INDEX `categories_woo_slug_key` ON `categories`;
ALTER TABLE `categories` DROP COLUMN `woo_slug`;
