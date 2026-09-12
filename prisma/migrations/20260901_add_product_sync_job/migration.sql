-- Fondasi sinkronisasi: antrean push ke WooCommerce.
--
-- ADITIF MURNI. Hanya menambah satu tabel dan dua kolom nullable.
-- Tidak ada DROP, MODIFY, atau RENAME. Tidak ada data yang disentuh.
--
-- CATATAN: `prisma migrate diff` menghasilkan tambahan DROP TABLE
-- `banner_batches`, DROP COLUMN `promo_banners.batch_id`, beserta foreign key
-- dan index-nya. Semuanya SENGAJA DIBUANG dari berkas ini — itu drift yang
-- sudah ada sebelumnya (tabel/kolom masih hidup di produksi dengan data, tapi
-- modelnya sudah tidak ada di schema.prisma) dan sama sekali tidak berkaitan
-- dengan sinkronisasi. Menghapusnya di sini berarti membuang data produksi
-- lewat migration yang judulnya soal hal lain. Drift itu dibereskan terpisah.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `last_synced_at` DATETIME(3) NULL,
    ADD COLUMN `sync_hash` VARCHAR(64) NULL;

-- CreateTable
CREATE TABLE `product_sync_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `dedupe_key` INTEGER NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_error` TEXT NULL,
    `claimed_at` DATETIME(3) NULL,
    `claimed_by` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_sync_jobs_dedupe_key_key`(`dedupe_key`),
    INDEX `product_sync_jobs_status_next_attempt_at_idx`(`status`, `next_attempt_at`),
    INDEX `product_sync_jobs_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_sync_jobs` ADD CONSTRAINT `product_sync_jobs_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
