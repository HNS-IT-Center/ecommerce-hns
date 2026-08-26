/**
 * Batas paket PC Prebuild — SENGAJA berdiri sendiri, terpisah dari `config.ts`.
 *
 * Panel admin adalah Client Component dan butuh angka ini untuk menonaktifkan
 * tombol "Tambah". Kalau ia mengimpornya dari `config.ts`, seluruh modul itu
 * ikut masuk bundle browser — termasuk `getPrisma()` dan `unstable_cache` — dan
 * build Turbopack gagal.
 *
 * Impor TIPE dari `config.ts` aman karena terhapus saat kompilasi; impor NILAI
 * tidak. Berkas ini tidak mengimpor apa pun, jadi aman dari kedua sisi.
 */

/**
 * Barang berbeda yang terpasang BERSAMAAN dalam satu langkah — bukan pilihan,
 * melainkan dua-duanya ikut dalam rakitan. Contoh nyatanya: satu NVMe cepat
 * untuk sistem plus satu NVMe besar untuk penyimpanan.
 *
 * Empat cukup. Langkah yang butuh lebih dari empat barang berbeda sebenarnya
 * bukan satu langkah — ia dua langkah yang tergabung, dan memisahnya di
 * `/admin/pc-builder` menghasilkan rakitan yang lebih mudah dibaca pelanggan.
 *
 * Ditegakkan di parser DAN di UI, tapi dengan cara berbeda: UI menonaktifkan
 * tombolnya, parser memotong kelebihannya. Lihat juga `allowMultiple` di
 * `PcBuilderStepConfig` — itu aturan milik PC Builder tentang boleh-tidaknya
 * satu langkah diisi lebih dari satu barang, dan panel prebuild menghormatinya
 * di UI. Parser TIDAK ikut menegakkannya: `allowMultiple` bisa dimatikan staff
 * kapan saja, dan kalau parser mematuhinya, mematikan sakelar di halaman lain
 * akan diam-diam menghapus komponen dari paket yang sudah tersusun.
 */
export const MAX_ITEMS_PER_SLOT = 4

/**
 * Pilihan tukar per barang — pelanggan memilih salah satu, yang PERTAMA bawaan.
 *
 * Tiga barang bercabang dengan tiga pilihan masing-masing sudah 27 kombinasi
 * harga di satu halaman. Lebih dari itu, halaman paket berubah jadi
 * konfigurator — dan untuk itu sudah ada PC Builder. Tiga cukup untuk kasus
 * nyata: 16/32 GB, hitam/putih, 1/2 TB.
 */
export const MAX_ALTERNATIVES_PER_ITEM = 3

/**
 * Barang yang boleh punya pilihan tukar, per paket.
 *
 * Sama seperti di atas: yang dibatasi adalah jumlah kombinasi yang harus
 * dicerna pelanggan dalam satu layar, bukan kerumitan datanya.
 */
export const MAX_BRANCHING_ITEMS = 3

/**
 * Jumlah per barang.
 *
 * Sepuluh sudah jauh di atas kebutuhan nyata (empat keping RAM, enam kipas),
 * dan angka ini ikut ke pesan WhatsApp yang diterima CS — jumlah yang meleset
 * karena salah ketik jadi tagihan yang harus ditolak di depan pelanggan.
 */
export const MAX_QUANTITY_PER_ITEM = 10

/**
 * Foto per paket: satu utama + tiga pendamping.
 *
 * Empat cukup untuk sudut yang benar-benar ditanyakan pelanggan — tampak depan,
 * dalam casing, tata kabel, belakang — dan pas sebagai satu baris thumbnail di
 * bawah foto utama. Lebih dari itu halaman paket berubah jadi galeri produk,
 * dan untuk itu halaman produk sudah ada.
 *
 * Mengisinya OPSIONAL. Paket berfoto satu tetap tampil rapi.
 */
export const MAX_PREBUILD_IMAGES = 4

/**
 * Nama lama, dipertahankan supaya berkas yang belum ikut dirombak tidak putus.
 *
 * @deprecated Pakai `MAX_ALTERNATIVES_PER_ITEM` dan `MAX_BRANCHING_ITEMS`.
 */
export const MAX_OPTIONS_PER_SLOT = MAX_ALTERNATIVES_PER_ITEM
/** @deprecated Pakai `MAX_BRANCHING_ITEMS`. */
export const MAX_BRANCHING_SLOTS = MAX_BRANCHING_ITEMS
