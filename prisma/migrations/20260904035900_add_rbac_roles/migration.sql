-- Menambah RBAC: tabel `roles` + `role_permissions`, kolom `users.role_id`,
-- dan dua foreign key. ADITIF MURNI — tidak ada tabel/kolom lama yang diubah
-- isinya atau dihapus.
--
-- ============================================================================
-- PERINGATAN: `migrate diff` MENGUSULKAN DROP TABLE accurate_* — JANGAN IKUT
-- ============================================================================
-- Sama seperti migration woo_slug (banner_batches dulu): `prisma migrate diff`
-- di branch ini ikut mengusulkan
--
--   DROP TABLE `accurate_products`;
--   DROP TABLE `accurate_woo_mapping`;
--
-- Kedua tabel itu HIDUP DI PRODUKSI (data Accurate ~7000 baris, diimpor 3 Sep
-- 2026) tapi SENGAJA tidak dimodelkan di schema.prisma — diakses lewat query
-- mariadb mentah (lib/api/accurate/*), bukan model Prisma. Karena tak ada di
-- schema, diff menganggapnya drift dan mau menghapusnya. Itu BUKAN drift mati:
-- menghapusnya membuang seluruh data Accurate. Kedua DROP itu SUDAH DIBUANG dari
-- berkas ini. Jangan kembalikan.
--
-- Baseline sebelum eksekusi (rekam saat apply): users, roles=0, role_permissions=0,
-- accurate_products & accurate_woo_mapping HARUS TETAP ADA setelah migrasi.
-- ============================================================================

-- AlterTable: kolom peran dinamis di users (NULLABLE — baris lama tak terkunci).
ALTER TABLE `users` ADD COLUMN `role_id` VARCHAR(191) NULL;

-- CreateTable: peran yang bisa dibuat lewat panel.
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: izin per (peran, halaman).
CREATE TABLE `role_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,
    `page` VARCHAR(48) NOT NULL,
    `access` VARCHAR(8) NOT NULL,

    UNIQUE INDEX `role_permissions_role_id_page_key`(`role_id`, `page`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: hapus peran → penggunanya kembali ke perilaku lama (SET NULL),
-- BUKAN terkunci.
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: hapus peran → izinnya ikut terhapus (CASCADE).
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
