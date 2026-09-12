-- Pembatalan untuk 20260904035900_add_rbac_roles.
--
-- Ditulis SEBELUM migration diterapkan — saat rollback dibutuhkan, keadaannya
-- sudah tidak nyaman untuk menyusun SQL dari nol.
--
-- Aman dijalankan: migration-nya aditif murni (dua tabel baru + satu kolom
-- nullable + dua foreign key), jadi membatalkannya hanya membuang apa yang ia
-- tambahkan. TIDAK ada baris data lama yang ikut hilang — kolom `role_id` yang
-- dibuang belum pernah diisi apa pun sampai UI Manajemen User ada.
--
-- Urutan sengaja: buang foreign key dulu (kalau tidak, DROP TABLE/COLUMN
-- ditolak karena masih direferensikan), lalu tabel & kolomnya.

ALTER TABLE `role_permissions` DROP FOREIGN KEY `role_permissions_role_id_fkey`;
ALTER TABLE `users` DROP FOREIGN KEY `users_role_id_fkey`;
DROP TABLE `role_permissions`;
DROP TABLE `roles`;
ALTER TABLE `users` DROP COLUMN `role_id`;
