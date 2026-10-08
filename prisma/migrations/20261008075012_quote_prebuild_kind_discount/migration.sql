-- Quotation untuk paket PC Prebuild (docs/17 §18).
--
-- `migrate diff` saat berkas ini dibuat juga mengusulkan DROP COLUMN
-- `accurate_ignored.tipe` dan DROP TABLE `accurate_products` /
-- `accurate_woo_mapping`. Itu selisih database lokal pembuatnya dengan skema,
-- BUKAN bagian pekerjaan ini — sengaja dibuang dari sini (docs/08 §3).
--
-- Semua kolom baru ber-DEFAULT, jadi aman untuk tabel yang sudah berisi:
-- baris lama otomatis kind = 'build' dan discount = 0 — persis keadaannya,
-- karena sebelum migrasi ini hanya PC Builder yang bisa menerbitkan quotation.

-- AlterTable
ALTER TABLE `pc_build_quote_revisions` ADD COLUMN `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `pc_build_quotes` ADD COLUMN `discount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `kind` VARCHAR(16) NOT NULL DEFAULT 'build',
    ADD COLUMN `prebuild_id` VARCHAR(64) NULL,
    ADD COLUMN `prebuild_name` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `pc_build_quotes_kind_idx` ON `pc_build_quotes`(`kind`);
