-- Halaman kebijakan jadi CRUD penuh: staff bisa MENAMBAH kebijakan baru, bukan
-- cuma menyunting empat yang sudah ada.
--
-- Semua kolom baru NULL atau ber-default, jadi aman dijalankan di tabel yang
-- sudah berisi empat baris kebijakan produksi — tidak ada UPDATE wajib sebelum
-- ALTER-nya bisa selesai.

-- AlterTable
ALTER TABLE `policy_pages` ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `deleted_by` VARCHAR(191) NULL,
    ADD COLUMN `description` VARCHAR(255) NULL,
    ADD COLUMN `is_system` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `policy_pages_deleted_at_idx` ON `policy_pages`(`deleted_at`);

-- Backfill keempat kebijakan bawaan.
--
-- `is_system = 1` mengunci tombol Hapus di panel admin untuk baris-baris ini.
-- Alamatnya ditaut dari kode yang tidak tahu apa-apa soal isi tabel: footer
-- (`/kebijakan`), halaman produk (`/kebijakan/pengiriman`), dan dari dalam isi
-- kebijakan satu sama lain. Baris yang hilang membuat tautan itu 404 diam-diam.
--
-- `description` diisi dengan teks yang selama ini jadi `metadata.description`
-- di masing-masing berkas halaman, supaya meta description yang sudah terindeks
-- Google tidak berubah saat halamannya pindah ke route dinamis.
--
-- Ditulis per-slug, bukan lewat CASE, supaya baris yang tidak ada di database
-- (mis. lingkungan yang belum pernah di-seed) cukup terlewat tanpa error.
UPDATE `policy_pages` SET `is_system` = 1, `sort_order` = 0,
  `description` = 'Syarat dan ketentuan pengembalian barang di HNS IT Center.'
  WHERE `slug` = 'pengembalian-barang';

UPDATE `policy_pages` SET `is_system` = 1, `sort_order` = 1,
  `description` = 'Syarat, metode, dan waktu proses pengembalian dana (refund) di HNS IT Center.'
  WHERE `slug` = 'pengembalian-dana';

UPDATE `policy_pages` SET `is_system` = 1, `sort_order` = 2,
  `description` = 'Ketentuan pembatalan pesanan di HNS IT Center.'
  WHERE `slug` = 'pembatalan-pesanan';

UPDATE `policy_pages` SET `is_system` = 1, `sort_order` = 3,
  `description` = 'Area, estimasi waktu, dan opsi pengiriman/pengambilan barang di HNS IT Center.'
  WHERE `slug` = 'pengiriman';
