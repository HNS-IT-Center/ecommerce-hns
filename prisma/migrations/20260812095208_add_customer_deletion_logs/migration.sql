-- Jejak penghapusan akun pelanggan.
--
-- Penghapusan akun pelanggan bersifat permanen (CLAUDE.md §2.8: hard delete,
-- cascade ke saved_pc_builds). Tanpa tabel ini, tindakan yang paling tidak bisa
-- dibatalkan di seluruh panel justru satu-satunya yang tidak meninggalkan bekas.
--
-- YANG SENGAJA TIDAK ADA DI SINI: email, nama, nomor HP, username. Itu justru
-- data yang pelanggan minta dihapus; menyalinnya ke tabel audit berarti
-- penghapusannya tidak pernah benar-benar terjadi. Yang tersisa cuma UUID tak
-- bermakna, angka, dan kalimat yang ditulis staff sendiri.
--
-- TIDAK ADA FOREIGN KEY, dua-duanya disengaja:
--
--   * ke `customers` — barisnya sudah tidak ada saat log ini ditulis, jadi FK
--     justru akan menolak penyimpanannya. Relasi apa pun ke tabel itu juga
--     berisiko menahan penghapusan yang seharusnya jalan.
--   * ke `users` — admin bisa dihapus (soft delete) belakangan, dan log ini
--     harus tetap utuh meski penghapusnya sudah tidak aktif.
--
-- `saved_build_count` diisi dari hitungan SEBELUM penghapusan. Sesudahnya
-- barisnya sudah lenyap lewat cascade dan angkanya tidak bisa direkonstruksi
-- dari mana pun.
--
-- Dua indeks, untuk dua pertanyaan yang wajar muncul: "apa saja yang dihapus
-- belakangan ini" (created_at) dan "apa saja yang pernah dihapus admin ini"
-- (deleted_by_user_id).
CREATE TABLE `customer_deletion_logs` (
    `id` VARCHAR(191) NOT NULL,
    `deleted_customer_id` VARCHAR(191) NOT NULL,
    `deleted_by_user_id` VARCHAR(191) NOT NULL,
    `saved_build_count` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_deletion_logs_created_at_idx`(`created_at`),
    INDEX `customer_deletion_logs_deleted_by_user_id_idx`(`deleted_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
