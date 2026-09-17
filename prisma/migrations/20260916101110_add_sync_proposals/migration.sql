-- Antrean usulan sinkronisasi WooCommerce -> katalog, hasil pemindaian
-- terjadwal (cron hPanel, 03:00 WIB). Lihat model `SyncProposal` di
-- schema.prisma untuk alasan di balik bentuknya.
--
-- CATATAN PENTING soal berkas ini.
--
-- `prisma migrate diff --from-config-datasource` menghasilkan DUA `DROP TABLE`
-- tambahan yang TIDAK ada hubungannya dengan pekerjaan ini:
--
--     DROP TABLE `accurate_products`;
--     DROP TABLE `accurate_woo_mapping`;
--
-- Keduanya SUDAH DIBUANG dari berkas ini dengan sengaja, dan tidak boleh
-- dikembalikan. Dua tabel itu hidup di database tapi sengaja tidak dimodelkan
-- di schema.prisma karena diakses lewat $queryRawUnsafe (lihat
-- lib/api/accurate/{price-table,import-sheet,stock-db}.ts). `migrate diff`
-- membandingkan database dengan skema, jadi tabel yang tidak dimodelkan selalu
-- tampak seperti "harus dihapus".
--
-- Menjalankannya akan mematikan fitur Update Harga Accurate beserta datanya.
-- Ini contoh persis dari yang diperingatkan docs/08 §3: "Perubahan yang bukan
-- milikmu ikut terbawa." Siapa pun yang membuat migrasi berikutnya di repo ini
-- akan bertemu dua DROP yang sama — buang lagi.

-- CreateTable
CREATE TABLE `sync_proposals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `woo_id` INTEGER NOT NULL,
    `kind` ENUM('NEW_PRODUCT', 'PRICE_CHANGE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'STALE') NOT NULL DEFAULT 'PENDING',
    `scanned_name` VARCHAR(500) NOT NULL,
    `dedupe_key` VARCHAR(64) NULL,
    `decided_by` VARCHAR(191) NULL,
    `decided_at` DATETIME(3) NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sync_proposals_dedupe_key_key`(`dedupe_key`),
    INDEX `sync_proposals_status_kind_idx`(`status`, `kind`),
    INDEX `sync_proposals_woo_id_idx`(`woo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
