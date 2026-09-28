-- Foto depan toko untuk popup peta dan kartu cabang di /stores.
-- Nullable: toko yang sudah ada belum punya foto, dan tanpa foto halaman
-- tampil tanpa area gambar — tidak perlu nilai awal.
--
-- CATATAN: `migrate diff` juga mengusulkan `DROP TABLE accurate_products` dan
-- `DROP TABLE accurate_woo_mapping` — dua tabel yang ada di database tapi tidak
-- dideklarasikan di schema.prisma. Itu BUKAN bagian perubahan ini dan sengaja
-- dibuang dari berkas ini (docs/08 §3).

-- AlterTable
ALTER TABLE `stores` ADD COLUMN `image_url` VARCHAR(1024) NULL;
