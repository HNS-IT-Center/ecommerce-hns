-- Login staff lewat HNS SSO (auth.hnsitcenter.id) — docs/19-sso-staff.md.
--
-- `sso_sub` menyimpan klaim `sub` dari SSO: UUID yang tidak pernah berubah
-- untuk satu orang. Email hanya dipakai sekali untuk menautkan akun pada login
-- SSO pertama; sesudahnya akun dicari lewat kolom ini, supaya alamat email yang
-- berpindah tangan di SSO tidak membawa orang baru masuk ke akun orang lama.
--
-- NULLABLE tanpa backfill (docs/08 §3): seluruh baris lama memang belum pernah
-- login lewat SSO. Unique index di MariaDB mengizinkan banyak NULL, jadi baris
-- lama tidak saling bentrok.
--
-- DITULIS TANGAN, bukan hasil `migrate diff` apa adanya: diff terhadap DB lokal
-- 15 Nov 2026 ikut membawa `DROP TABLE accurate_products`,
-- `DROP TABLE accurate_woo_mapping`, dan `DROP COLUMN accurate_ignored.tipe` —
-- sisa skema lama di database itu, bukan bagian pekerjaan ini (docs/08 §3).

-- AlterTable
ALTER TABLE `users` ADD COLUMN `sso_sub` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_sso_sub_key` ON `users`(`sso_sub`);
