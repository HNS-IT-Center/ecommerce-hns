-- Menandai asal-usul tiap produk, supaya sinkronisasi WooCommerce tahu baris
-- mana yang boleh ia sentuh. Alasan lengkapnya ada di komentar `ProductSource`
-- pada prisma/schema.prisma.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `source` ENUM('WOO', 'LOCAL') NOT NULL DEFAULT 'LOCAL';

-- Backfill. Kolomnya default 'LOCAL' (pilihan yang tidak merusak data untuk
-- baris baru), tapi seluruh isi tabel saat ini justru datang dari WooCommerce,
-- jadi tanpa langkah ini sinkronisasi akan melewati SEMUA produk yang ada.
--
-- Pembatasnya `imported_at`, bukan daftar id hafalan: 5.193 baris masuk lewat
-- dua batch import (2026-07-23 dan 2026-07-24), dan hanya 3 baris yang lahir
-- sesudahnya — produk yang dibuat staff lewat panel admin pada 2 / 6 / 7
-- Agustus 2026. Ketiganya terbukti tidak ada di katalog WooCommerce.
--
-- Kalau suatu saat baris hasil import ikut tertinggal di sini, akibatnya hanya
-- produk itu berhenti menerima pembaruan harga sampai ditandai ulang — bukan
-- kehilangan data.
UPDATE `products` SET `source` = 'WOO' WHERE `imported_at` < '2026-07-25';
