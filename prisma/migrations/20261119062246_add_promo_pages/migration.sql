-- Halaman promo /promo/<slug> — docs/20-halaman-promo.md.
--
-- Tiga perubahan, semuanya MENAMBAH, tidak ada yang mengubah data lama:
--   1. tabel `promos` — judul, slug, deskripsi, syarat, jadwal. Tanpa harga
--      atau potongan apa pun (CLAUDE.md §2.7): harga tetap dibaca dari katalog.
--   2. tabel `promo_products` — produk yang tercantum di satu promo.
--   3. `promo_banners.promo_id` NULLABLE tanpa backfill (docs/08 §3): banner
--      lama memang belum menaut promo apa pun dan tetap memakai `cta_href`.
--
-- DITULIS TANGAN dari hasil `migrate diff`: diff terhadap DB lokal 19 Nov 2026
-- ikut membawa `DROP TABLE accurate_products` dan `DROP TABLE
-- accurate_woo_mapping` — sisa skema lama di database itu, bukan bagian
-- pekerjaan ini. Keduanya sengaja dibuang dari berkas ini.

-- AlterTable
ALTER TABLE `promo_banners` ADD COLUMN `promo_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `promos` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(160) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `terms` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `promos_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promo_products` (
    `promo_id` VARCHAR(191) NOT NULL,
    `product_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `promo_products_product_id_idx`(`product_id`),
    PRIMARY KEY (`promo_id`, `product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `promo_banners_promo_id_idx` ON `promo_banners`(`promo_id`);

-- AddForeignKey
ALTER TABLE `promo_banners` ADD CONSTRAINT `promo_banners_promo_id_fkey` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_products` ADD CONSTRAINT `promo_products_promo_id_fkey` FOREIGN KEY (`promo_id`) REFERENCES `promos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promo_products` ADD CONSTRAINT `promo_products_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

