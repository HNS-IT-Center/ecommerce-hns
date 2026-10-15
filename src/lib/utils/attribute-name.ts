/**
 * Helper nama atribut — sengaja berdiri sendiri, TANPA dependensi apa pun,
 * karena dipakai dari server (penyimpanan produk, panel Atribut & Brand) dan
 * dari komponen klien (editor varian). Alasannya sama dengan `slug.ts`.
 */

/**
 * "CPU Socket Type:" → "CPU Socket Type".
 *
 * Nama atribut diketik bebas di form admin, lalu dicari di tabel `attributes`
 * berdasarkan nama PERSIS. Satu titik dua di ujung — kebiasaan yang terbawa
 * dari menulis deskripsi ("Socket:", "Brand:") — sudah cukup untuk melahirkan
 * atribut kembar. Kembaran itu tidak tampak di mana pun, tapi PC Builder
 * menyaring kompatibilitas berdasarkan id atribut: motherboard bernilai
 * "LGA 1700" di bawah "CPU Socket Type:" lenyap dari grid begitu prosesor
 * LGA 1700 dipilih, karena syaratnya ada di bawah "CPU Socket Type".
 *
 * Yang dirapikan hanya bentuk yang jelas tidak disengaja: spasi berlebih dan
 * titik dua di ujung. Besar-kecil huruf tidak perlu disentuh — kolasi kolom
 * `attributes.name` sudah menganggap "Warna" dan "WARNA" sama.
 *
 * Sinonim ("Socket" vs "CPU Socket Type") TIDAK tertangkap di sini; itu urusan
 * merapikan data, bukan menebak maksud dari ejaan.
 */
export function normalizeAttributeName(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*:+$/, "")
}
