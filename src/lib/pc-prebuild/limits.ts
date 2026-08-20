/**
 * Batas paket PC Prebuild — SENGAJA berdiri sendiri, terpisah dari `config.ts`.
 *
 * Panel admin (`prebuild-manager.tsx`) adalah Client Component dan butuh angka
 * ini untuk menonaktifkan tombol "Tambah pilihan". Kalau ia mengimpornya dari
 * `config.ts`, seluruh modul itu ikut masuk bundle browser — termasuk
 * `getPrisma()` dan `unstable_cache` — dan build Turbopack gagal.
 *
 * Impor TIPE dari `config.ts` aman karena terhapus saat kompilasi; impor NILAI
 * tidak. Berkas ini tidak mengimpor apa pun, jadi aman dari kedua sisi.
 *
 * ## Kenapa angkanya segini
 *
 * Tiga slot bercabang dengan tiga pilihan masing-masing sudah 27 kombinasi
 * harga di satu halaman. Lebih dari itu, halaman detail berubah jadi
 * konfigurator — dan untuk itu sudah ada PC Builder. Tiga cukup untuk kasus
 * nyata: 16/32 GB, hitam/putih, 1/2 TB.
 */
export const MAX_OPTIONS_PER_SLOT = 3
export const MAX_BRANCHING_SLOTS = 3
