-- ROLLBACK untuk 20260901_add_product_sync_job
--
-- Ditulis SEBELUM migration diterapkan, sesuai aturan: skrip pembatalan
-- disiapkan lebih dulu, bukan disusun saat sedang panik.
--
-- Karena migration-nya aditif murni, membatalkannya tidak menghilangkan data
-- lama apa pun. Yang hilang hanya isi product_sync_jobs (antrean job) dan nilai
-- sync_hash/last_synced_at — semuanya data turunan yang bisa dibentuk ulang.
--
-- Jalankan lewat SQL client, BUKAN lewat prisma.
-- Sesudahnya, hapus juga baris migration ini dari tabel _prisma_migrations
-- (perintah terakhir), supaya `prisma migrate status` tidak menganggapnya
-- sudah ter-apply.

-- 1) Buang foreign key lebih dulu, lalu tabelnya
ALTER TABLE `product_sync_jobs` DROP FOREIGN KEY `product_sync_jobs_product_id_fkey`;
DROP TABLE IF EXISTS `product_sync_jobs`;

-- 2) Buang dua kolom di products
ALTER TABLE `products` DROP COLUMN `sync_hash`;
ALTER TABLE `products` DROP COLUMN `last_synced_at`;

-- 3) Hapus catatan migration supaya riwayat Prisma konsisten
DELETE FROM `_prisma_migrations` WHERE `migration_name` = '20260901_add_product_sync_job';

-- 4) Verifikasi sesudah rollback:
--    SHOW TABLES LIKE 'product_sync_jobs';        -> 0 baris
--    SHOW COLUMNS FROM products LIKE 'sync%';     -> 0 baris
--    SELECT COUNT(*) FROM products;               -> harus SAMA seperti sebelum migration
