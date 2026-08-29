-- Batch banner: kampanye yang menaungi beberapa banner sekaligus.
--
-- CATATAN - satu baris SENGAJA dibuang dari hasil `prisma migrate diff`.
--
-- Perintah itu membandingkan skema dengan DATABASE, bukan dengan pekerjaan ini.
-- Karena repo lokal saat itu tertinggal 7 commit dari origin/development, kolom
-- `products.source` sudah ada di database tapi belum ada di schema.prisma
-- lokal - sehingga diff menyimpulkan kolom itu harus dibuang:
--
--     ALTER TABLE `products` DROP COLUMN `source`;
--
-- Kolom itu milik commit de22f14 (fitur sinkronisasi WooCommerce), lengkap
-- dengan dua migrasinya sendiri dan backfill atas 5.400+ baris. Menjalankannya
-- akan menghapus pekerjaan orang lain yang sedang berjalan.
--
-- docs/08-database-migrations.md: "Kalau ada DROP COLUMN yang tidak kamu
-- rencanakan, hentikan dan tanyakan dulu ke yang membuatnya."
--
-- Setelah origin/development ditarik, selisih ini hilang dengan sendirinya dan
-- berkas ini sebaiknya digenerate ulang supaya bersih tanpa perlu catatan ini.

-- AlterTable
ALTER TABLE `promo_banners` ADD COLUMN `batch_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `banner_batches` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `starts_at` DATETIME(3) NULL,
    `ends_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `promo_banners_batch_id_idx` ON `promo_banners`(`batch_id`);

-- AddForeignKey
ALTER TABLE `promo_banners` ADD CONSTRAINT `promo_banners_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `banner_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

