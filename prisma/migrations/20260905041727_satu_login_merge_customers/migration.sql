-- Satu Login (Fase A): perluas `users` agar menampung pelanggan, pindahkan
-- baris `customers` ke `users` dengan role="pelanggan", arahkan FK relasi
-- pelanggan (saved_pc_builds, customer_verification_tokens) ke `users`.
--
-- ============================================================================
-- CATATAN: migration ini SUDAH DITERAPKAN ke produksi 5 Sep 2026 lewat SQL
-- langsung (setelah diuji penuh di DB salinan u859138789_restore_uji). Berkas
-- ini merekamnya agar riwayat migrasi ↔ database selaras; tandai sebagai sudah
-- diterapkan dengan `prisma migrate resolve --applied
-- 20260905041727_satu_login_merge_customers`, JANGAN dijalankan ulang.
--
-- ADITIF untuk `users` (kolom + longgarkan nullable); tabel `customers` TIDAK
-- dihapus — masih dibaca `getCurrentCustomer` sampai konsolidasi sesi (Fase B).
--
-- migrate diff akan mengusulkan DROP TABLE accurate_products & accurate_woo_mapping
-- (tak dimodelkan, diakses raw) — JANGAN masukkan; mereka data hidup.
-- ============================================================================

-- Longgarkan kolom wajib users jadi nullable (pelanggan Google tak punya).
ALTER TABLE `users` MODIFY `username` VARCHAR(191) NULL;
ALTER TABLE `users` MODIFY `password_hash` VARCHAR(255) NULL;

-- Kolom khas pelanggan (nullable — admin lama tak punya).
ALTER TABLE `users` ADD COLUMN `google_sub` VARCHAR(191) NULL;
ALTER TABLE `users` ADD COLUMN `phone_number` VARCHAR(20) NULL;
ALTER TABLE `users` ADD COLUMN `email_verified_at` DATETIME(3) NULL;
ALTER TABLE `users` ADD COLUMN `sessions_revoked_at` DATETIME(3) NULL;
CREATE UNIQUE INDEX `users_google_sub_key` ON `users`(`google_sub`);

-- Pindahkan pelanggan ke users, id ASLI dipertahankan, role="pelanggan".
INSERT INTO `users`
  (`id`, `email`, `name`, `username`, `password_hash`, `google_sub`,
   `phone_number`, `email_verified_at`, `sessions_revoked_at`, `role`,
   `created_at`, `updated_at`)
SELECT
  c.`id`, c.`email`, c.`name`, c.`username`, c.`password_hash`, c.`google_sub`,
  c.`phone_number`, c.`email_verified_at`, c.`sessions_revoked_at`, 'pelanggan',
  c.`created_at`, c.`updated_at`
FROM `customers` c;

-- Arahkan FK relasi pelanggan dari customers.id ke users.id (id sama).
ALTER TABLE `saved_pc_builds` DROP FOREIGN KEY `saved_pc_builds_customer_id_fkey`;
ALTER TABLE `saved_pc_builds`
  ADD CONSTRAINT `saved_pc_builds_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_verification_tokens` DROP FOREIGN KEY `customer_verification_tokens_customer_id_fkey`;
ALTER TABLE `customer_verification_tokens`
  ADD CONSTRAINT `customer_verification_tokens_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
