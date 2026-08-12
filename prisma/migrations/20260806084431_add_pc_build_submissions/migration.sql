-- Rakitan yang DIKIRIM pelanggan lewat tombol "Kirim ke HNS".
--
-- Tabel sendiri, bukan kolom tambahan di `pc_build_quotes`, karena `content_hash`
-- di sana UNIK: dua baris dengan isi rakitan sama mustahil ada. Menaruh identitas
-- pengirim di tabel itu membuat kiriman pelanggan yang isinya kebetulan sama
-- dengan quotation staff MENIMPA datanya, dan pelanggan kedua menimpa yang
-- pertama.
--
-- Tidak ada constraint unik apa pun di sini: satu baris per kiriman, selalu.
-- Dua orang mengirim rakitan yang sama adalah dua prospek, bukan satu.
--
-- Relasi lewat `quote_id`, bukan `quote_code` — kode dibaca manusia dan formatnya
-- bisa berubah; relasi yang bersandar padanya akan putus kalau itu terjadi.
--
-- `customer_name`/`customer_phone` adalah DATA PRIBADI dengan retensi 12 bulan,
-- dan tabel ini tidak boleh terjangkau dari endpoint publik mana pun.

-- CreateTable
CREATE TABLE `pc_build_submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quote_id` INTEGER NOT NULL,
    `quote_code` VARCHAR(32) NOT NULL,
    `customer_name` VARCHAR(120) NOT NULL,
    `customer_phone` VARCHAR(32) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'baru',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pc_build_submissions_status_created_at_idx`(`status`, `created_at`),
    INDEX `pc_build_submissions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pc_build_submissions` ADD CONSTRAINT `pc_build_submissions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `pc_build_quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

