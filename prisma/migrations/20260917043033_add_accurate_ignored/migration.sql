-- Penanda barang Accurate yang sengaja tidak akan ditautkan ke produk web.
-- Lihat model `AccurateIgnored` di schema.prisma untuk alasan bentuknya.
--
-- CATATAN, SAMA SEPERTI MIGRASI SEBELUMNYA.
--
-- `prisma migrate diff --from-config-datasource` kembali menghasilkan dua
-- `DROP TABLE` yang tidak ada hubungannya dengan pekerjaan ini:
--
--     DROP TABLE `accurate_products`;
--     DROP TABLE `accurate_woo_mapping`;
--
-- Keduanya SUDAH DIBUANG dan tidak boleh dikembalikan. Dua tabel itu hidup di
-- database tapi sengaja tidak dimodelkan di schema.prisma karena diakses lewat
-- $queryRawUnsafe (lihat lib/api/accurate/{price-table,import-sheet,stock-db}.ts).
-- `migrate diff` membandingkan database dengan skema, jadi tabel yang tidak
-- dimodelkan selalu tampak seperti "harus dihapus".
--
-- Menjalankannya akan mematikan fitur Update Harga Accurate beserta datanya —
-- termasuk tabel yang justru jadi acuan penanda di bawah ini.
--
-- Ini kedua kalinya jebakan yang sama muncul (yang pertama:
-- 20260916101110_add_sync_proposals). Siapa pun yang membuat migrasi berikutnya
-- akan bertemu dua DROP ini lagi — buang lagi. Lihat docs/08 §3.

-- CreateTable
CREATE TABLE `accurate_ignored` (
    `kode_accurate` VARCHAR(50) NOT NULL,
    `alasan` VARCHAR(255) NULL,
    `ditandai_oleh` VARCHAR(191) NOT NULL,
    `ditandai_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`kode_accurate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
