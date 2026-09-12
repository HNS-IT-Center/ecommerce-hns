-- Dua perubahan yang menumpuk sejak database berhenti dikelola `db push`.
--
-- 1. `stores.slug` — alamat halaman cabang, dipisah dari `id`.
-- 2. `pc_build_quotes` — pelacakan cetak quotation. Ini bagian dari perubahan
--    skema yang masuk lewat merge dari branch development dan belum pernah
--    diterapkan ke database; baru ketahuan saat migrasi ini disusun.

-- ---------------------------------------------------------------- quotations
DROP INDEX `pc_build_quotes_updated_at_idx` ON `pc_build_quotes`;

-- CATATAN: `updated_at` dibuang beserta isinya. Tabelnya berisi 3 baris saat
-- migrasi ini ditulis, dan kolom itu tidak dibaca kode mana pun setelah merge.
ALTER TABLE `pc_build_quotes` DROP COLUMN `updated_at`,
    ADD COLUMN `last_printed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `print_count` INTEGER NOT NULL DEFAULT 1;

CREATE INDEX `pc_build_quotes_last_printed_at_idx` ON `pc_build_quotes`(`last_printed_at`);

-- -------------------------------------------------------------------- stores
--
-- Empat langkah, bukan satu. Perintah yang dihasilkan `migrate diff` —
-- `ADD COLUMN slug VARCHAR(191) NOT NULL` lalu indeks unik — mengasumsikan
-- tabelnya kosong. Tabel ini berisi dua cabang, jadi perintah itu akan gagal:
-- tidak ada nilai untuk baris yang sudah ada, dan indeks uniknya menabrak dua
-- string kosong.
--
-- Nilai awalnya diturunkan dari `id`, yang di database ini sudah berbentuk slug
-- ("nagoya-gateway", "nagoya-hill"). LOWER/REPLACE tetap dipasang supaya id yang
-- mengandung huruf besar atau spasi — bentuk yang sempat dipakai sebelumnya —
-- tetap menghasilkan slug yang sah.
ALTER TABLE `stores` ADD COLUMN `slug` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `stores`
SET `slug` = LOWER(REPLACE(REPLACE(TRIM(`id`), ' ', '-'), '_', '-'))
WHERE `slug` = '';

-- Default dibuang setelah backfill: skema Prisma tidak punya default untuk
-- kolom ini, dan membiarkannya membuat migrasi berikutnya melihat drift.
ALTER TABLE `stores` ALTER COLUMN `slug` DROP DEFAULT;

CREATE UNIQUE INDEX `stores_slug_key` ON `stores`(`slug`);
