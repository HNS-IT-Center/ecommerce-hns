-- Sinkron stok & HPP dari API Data Accurate (docs/13 §10).
--
-- `migrate diff` juga mengusulkan DROP TABLE `accurate_products` /
-- `accurate_woo_mapping` dan DROP COLUMN `accurate_ignored.tipe`. JANGAN.
-- `accurate_products` dipakai halaman Update Harga lewat SQL mentah (bukan model
-- Prisma, jadi diff menganggapnya "tidak ada di skema"). Sengaja dibuang dari
-- sini — sama seperti migrasi 20261008075012.
--
-- Semuanya menambah: satu kolom nullable dan dua tabel baru. Aman diterapkan
-- sebelum kode baru hidup (docs/10 "Migrasi ikut berjalan saat build").

-- AlterTable
ALTER TABLE `products` ADD COLUMN `stock_synced_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `accurate_items` (
    `id` INTEGER NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(16) NOT NULL,
    `category_name` VARCHAR(191) NULL,
    `brand_name` VARCHAR(191) NULL,
    `unit` VARCHAR(32) NULL,
    `status` VARCHAR(16) NOT NULL,
    `stock_web` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `stock_total` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `stock_by_warehouse` JSON NOT NULL,
    `cost` DECIMAL(14, 2) NULL,
    `accurate_updated_at` DATETIME(3) NULL,
    `changed_at` DATETIME(3) NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `accurate_items_code_idx`(`code`),
    INDEX `accurate_items_stock_web_idx`(`stock_web`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accurate_sync_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `trigger` VARCHAR(16) NOT NULL,
    `user_name` VARCHAR(191) NULL,
    `delivery_id` VARCHAR(64) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `items_received` INTEGER NOT NULL DEFAULT 0,
    `products_updated` INTEGER NOT NULL DEFAULT 0,
    `products_skipped_zero` INTEGER NOT NULL DEFAULT 0,
    `unlinked_with_stock` INTEGER NOT NULL DEFAULT 0,
    `source_synced_at` DATETIME(3) NULL,
    `error` TEXT NULL,

    UNIQUE INDEX `accurate_sync_runs_delivery_id_key`(`delivery_id`),
    INDEX `accurate_sync_runs_started_at_idx`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
