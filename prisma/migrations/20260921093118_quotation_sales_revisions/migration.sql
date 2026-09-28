-- Quotation rakitan PC: nomor urut, pemilik (Sales/CS), revisi, status jual.
--
-- ============================================================================
-- KEPUTUSAN 1 — kenapa unique `content_hash` dilepas
-- ============================================================================
-- Sampai hari ini satu baris `pc_build_quotes` = satu KOMBINASI komponen: dua
-- orang yang merakit isi sama persis berbagi satu dokumen, dan itu disengaja
-- untuk menahan duplikat (satu orang biasa menekan Print berkali-kali).
--
-- Aturan itu tidak bisa bertahan sekarang. Quotation punya PEMILIK, nama
-- pelanggan, dan status jual — dua penawaran untuk dua orang berbeda tidak
-- boleh jadi satu baris hanya karena isinya kebetulan sama. Kalau dedupe
-- dipertahankan, quotation Sales A bisa "berubah pemilik" saat Sales B
-- mencetak rakitan identik, dan closing salah satunya menutup dua-duanya.
--
-- Penahan duplikat yang menggantikannya bukan constraint, melainkan perubahan
-- alur: nomor hanya terbit lewat aksi eksplisit (server action), tidak lagi
-- sebagai efek samping GET halaman cetak. Refresh atau buka ulang tab PDF tidak
-- pernah menerbitkan nomor baru.
--
-- `content_hash` tetap dihitung dan tetap diindeks — masih berguna untuk
-- menjawab "rakitan ini pernah ditawarkan ke siapa saja", hanya tidak lagi
-- menjadi kunci identitas.
--
-- ============================================================================
-- KEPUTUSAN 2 — kenapa semua kolom baru nullable / berdefault
-- ============================================================================
-- Tabel ini sudah berisi data produksi. `ADD COLUMN ... NOT NULL` tanpa default
-- akan gagal di tabel berisi (docs/08 §3), jadi tidak ada satu pun kolom wajib
-- di bawah. `period`/`sequence` NULL menandai baris berkode format lama, yang
-- memang tidak pernah punya nomor urut; MariaDB mengizinkan banyak NULL pada
-- unique index, sehingga seluruh baris lama tidak saling bentrok.
--
-- `status` berdefault 'terbit' → semua quotation lama otomatis berstatus terbit.
-- Disengaja: tidak ada satu pun dari mereka yang pernah ditandai terjual.
--
-- ============================================================================
-- YANG SENGAJA TIDAK ADA DI BERKAS INI
-- ============================================================================
-- `prisma migrate diff --from-config-datasource` membandingkan dengan DATABASE,
-- bukan dengan pekerjaan ini, sehingga ia ikut mengusulkan:
--
--     DROP TABLE `accurate_products`;
--     DROP TABLE `accurate_woo_mapping`;
--
-- KEDUANYA DIBUANG DARI MIGRASI INI. Dua tabel itu hidup dan dipakai (7.091 dan
-- 4.721 baris; dibaca `lib/api/accurate/*` dan `lib/services/accurate-price.ts`)
-- — mereka hanya dikelola lewat SQL mentah, bukan lewat model Prisma, jadi diff
-- menganggapnya tidak dikenal. Menjalankannya berarti mematikan sinkronisasi
-- harga & stok Accurate. Lihat docs/08 §3.

-- Unique dilepas, lalu langsung dipasang indeks biasa sebagai gantinya.
-- Keduanya berdampingan supaya `content_hash` tidak sempat tanpa indeks sama
-- sekali — DDL di MariaDB tidak transaksional, jadi jeda di antara keduanya
-- adalah jeda yang benar-benar terjadi di database.
-- DropIndex
DROP INDEX `pc_build_quotes_content_hash_key` ON `pc_build_quotes`;

-- CreateIndex
CREATE INDEX `pc_build_quotes_content_hash_idx` ON `pc_build_quotes`(`content_hash`);

-- AlterTable
ALTER TABLE `pc_build_quotes` ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `closed_by_user_id` VARCHAR(191) NULL,
    ADD COLUMN `created_by_user_id` VARCHAR(191) NULL,
    ADD COLUMN `customer_name` VARCHAR(120) NULL,
    ADD COLUMN `customer_phone` VARCHAR(20) NULL,
    ADD COLUMN `handover_seen_at` DATETIME(3) NULL,
    ADD COLUMN `internal_note` TEXT NULL,
    ADD COLUMN `owner_user_id` VARCHAR(191) NULL,
    ADD COLUMN `period` CHAR(6) NULL,
    ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `sales_name` VARCHAR(60) NULL,
    ADD COLUMN `sequence` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(16) NOT NULL DEFAULT 'terbit';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `sales_display_name` VARCHAR(60) NULL;

-- CreateTable
CREATE TABLE `pc_build_quote_revisions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_id` INTEGER NOT NULL,
    `revision` INTEGER NOT NULL,
    `items` JSON NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `assembly_fee` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `item_count` INTEGER NOT NULL,
    `used_latest_prices` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pc_build_quote_revisions_quote_id_revision_key`(`quote_id`, `revision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Penghitung nomor urut per periode. Satu baris per bulan.
-- Tabel tersendiri, BUKAN `MAX(sequence) + 1`: MAX tidak mengunci apa pun, jadi
-- dua penerbitan bersamaan membaca angka yang sama dan salah satunya gagal pada
-- unique index `pc_build_quotes_period_sequence_key`.
-- CreateTable
CREATE TABLE `pc_build_quote_counters` (
    `period` CHAR(6) NOT NULL,
    `last_number` INTEGER NOT NULL,

    PRIMARY KEY (`period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Jejak perubahan status jual. Membatalkan closing menghapus angka penjualan
-- seorang sales; tanpa tabel ini, tindakan itu satu-satunya di alur ini yang
-- tidak meninggalkan bekas.
-- CreateTable
CREATE TABLE `pc_build_quote_status_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_id` INTEGER NOT NULL,
    `from_status` VARCHAR(16) NOT NULL,
    `to_status` VARCHAR(16) NOT NULL,
    `by_user_id` VARCHAR(191) NULL,
    `reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pc_build_quote_status_logs_quote_id_created_at_idx`(`quote_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `pc_build_quotes_owner_user_id_updated_at_idx` ON `pc_build_quotes`(`owner_user_id`, `updated_at`);

-- CreateIndex
CREATE INDEX `pc_build_quotes_created_by_user_id_updated_at_idx` ON `pc_build_quotes`(`created_by_user_id`, `updated_at`);

-- Rekap penjualan bulanan per sales dihitung dari `closed_at`, bukan tanggal
-- terbit — quotation Agustus yang deal September adalah penjualan September.
-- CreateIndex
CREATE INDEX `pc_build_quotes_status_closed_at_idx` ON `pc_build_quotes`(`status`, `closed_at`);

-- CreateIndex
CREATE INDEX `pc_build_quotes_customer_name_idx` ON `pc_build_quotes`(`customer_name`);

-- CreateIndex
CREATE UNIQUE INDEX `pc_build_quotes_period_sequence_key` ON `pc_build_quotes`(`period`, `sequence`);

-- AddForeignKey
ALTER TABLE `pc_build_quotes` ADD CONSTRAINT `pc_build_quotes_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quotes` ADD CONSTRAINT `pc_build_quotes_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quotes` ADD CONSTRAINT `pc_build_quotes_closed_by_user_id_fkey` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quote_revisions` ADD CONSTRAINT `pc_build_quote_revisions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `pc_build_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quote_revisions` ADD CONSTRAINT `pc_build_quote_revisions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quote_status_logs` ADD CONSTRAINT `pc_build_quote_status_logs_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `pc_build_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pc_build_quote_status_logs` ADD CONSTRAINT `pc_build_quote_status_logs_by_user_id_fkey` FOREIGN KEY (`by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
