-- Penambat tetap antara katalog web dan database kasir Accurate.
-- Rencana lengkapnya: docs/13-sinkronisasi-harga-accurate.md
--
-- ============================================================================
-- DUA `DROP TABLE` SUDAH DIBUANG DARI HASIL `migrate diff` — JANGAN
-- DIKEMBALIKAN.
--
-- Perintahnya mengusulkan `DROP TABLE accurate_products` dan
-- `DROP TABLE accurate_woo_mapping` karena keduanya TIDAK dimodelkan di
-- schema.prisma — mereka disalin dari database `updatewoo` dan dibaca lewat
-- raw query (lihat lib/api/accurate/stock-db.ts). Bagi `migrate diff` yang
-- membandingkan skema nyata dengan schema.prisma, tabel tanpa model berarti
-- "kelebihan, hapus saja".
--
-- Menjalankannya apa adanya menghapus 7.041 barang Accurate beserta seluruh
-- pemetaannya. docs/08 §3 memperingatkan persis kasus ini: BACA SQL-nya, jangan
-- langsung percaya.
-- ============================================================================

-- Kode barang di Accurate (`accurate_products`.`Kode Accurate`).
--
-- NULL untuk mayoritas produk, dan itu keadaan normal: saat kolom ini dibuat,
-- dari 7.041 barang Accurate hanya 976 yang punya kaitan sah ke produk web.
--
-- VARCHAR(50) — kode terpanjang yang ada 15 karakter, jadi lapang tanpa boros.
ALTER TABLE `products` ADD COLUMN `accurate_code` VARCHAR(50) NULL;

-- UNIK: satu kode Accurate hanya boleh menambat satu produk.
--
-- Tanpa ini satu barang bisa mengirim harganya ke beberapa produk sekaligus,
-- dan itu bukan kekhawatiran teoretis: `accurate_woo_mapping` yang lama memuat
-- satu "produk" (woo_product_id = 0) yang menyerap 1.092 kode sekaligus.
--
-- Multiple NULL tetap sah di MariaDB, jadi keunikan ini tidak menghalangi
-- ribuan produk yang belum tertaut.
CREATE UNIQUE INDEX `products_accurate_code_key` ON `products`(`accurate_code`);
