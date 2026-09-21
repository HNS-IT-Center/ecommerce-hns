-- Dijalankan SEKALI, saat volume data container dibuat pertama kali.
-- (Menghapus volume-nya — `npm run db:reset` — membuatnya jalan lagi.)

-- Izin penuh untuk user `hns`, termasuk membuat database baru.
--
-- Di produksi user Hostinger SENGAJA tidak punya izin ini, dan itulah sebab
-- `prisma migrate dev` dilarang di repo ini (docs/08): tanpa CREATE DATABASE,
-- shadow database tidak bisa dibuat. Di laptop batasan itu tidak ada gunanya —
-- justru sebaliknya, izin ini yang membuat `prisma migrate diff` bisa memakai
-- shadow database lokal untuk MENYUSUN berkas migrasi dengan aman, tanpa
-- menanyai database produksi.
--
-- Ini TIDAK melonggarkan larangan `migrate dev`/`db push`: keduanya tetap
-- dilarang, karena yang dijaga aturan itu adalah riwayat migrasi yang sama
-- untuk semua orang, bukan sekadar hak akses.
GRANT ALL PRIVILEGES ON *.* TO 'hns'@'%';
FLUSH PRIVILEGES;
