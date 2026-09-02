-- Pembatalan untuk 20260902_add_product_woo_slug.
--
-- Ditulis SEBELUM migration diterapkan, bukan sesudah — saat rollback
-- dibutuhkan, keadaannya sudah tidak nyaman untuk menyusun SQL dari nol.
--
-- Aman dijalankan: migration-nya aditif murni, jadi membatalkannya hanya
-- membuang kolom yang ia tambahkan. Tidak ada data lama yang ikut hilang.
--
-- Yang HILANG kalau ini dijalankan: isi kolom woo_slug itu sendiri, yaitu peta
-- 301 redirect. Peta itu bisa dibangun ulang kapan saja dari WooCommerce API
-- selama situs lama masih hidup. Setelah 13 September situs itu mati — sejak
-- saat itu, jalankan ini hanya kalau petanya sudah dicadangkan.

ALTER TABLE `products` DROP COLUMN `woo_slug`;
