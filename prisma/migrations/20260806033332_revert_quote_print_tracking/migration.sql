-- Mengembalikan `pc_build_quotes` ke bentuk yang dipakai skema setelah merge
-- dari branch development.
--
-- Migrasi sebelumnya (20260805085409) menerapkan `last_printed_at` dan
-- `print_count` ke database. Bentuk itu ikut terbawa ke sini lewat merge
-- sebelumnya dan sempat diterapkan, TAPI MrPrasetyo kemudian menyederhanakannya
-- kembali ke satu kolom `updated_at`. Keputusan mengikuti versinya sudah
-- dikonfirmasi ke dia.
--
-- Git tidak melihat pertentangan ini sebagai konflik: yang bertabrakan adalah
-- skema dengan DATABASE, bukan berkas dengan berkas. Tanpa migrasi ini, menulis
-- quotation gagal dengan "Unknown column 'updated_at'" — kode mencari kolom yang
-- tidak ada.
--
-- CATATAN KEHILANGAN DATA: `print_count` dibuang beserta isinya. Saat migrasi
-- ini ditulis tabelnya berisi 3 baris, semuanya quotation uji coba, dan tidak
-- ada laporan yang membacanya. `last_printed_at` juga hilang; `updated_at` yang
-- menggantikannya diisi CURRENT_TIMESTAMP untuk baris yang sudah ada, jadi
-- ketiganya akan tampak baru saja disegarkan.

DROP INDEX `pc_build_quotes_last_printed_at_idx` ON `pc_build_quotes`;

ALTER TABLE `pc_build_quotes` DROP COLUMN `last_printed_at`,
    DROP COLUMN `print_count`,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE INDEX `pc_build_quotes_updated_at_idx` ON `pc_build_quotes`(`updated_at`);
