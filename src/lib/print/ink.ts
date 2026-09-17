/**
 * Palet tinta untuk dokumen cetak (quotation Build PC, lembar spesifikasi PC
 * Prebuild).
 *
 * ## Tentang CMYK — apa yang bisa dan tidak bisa dijamin
 *
 * Browser SELALU membuat PDF dalam RGB; tidak ada CSS yang bisa memaksa ruang
 * warna CMYK. Konversinya terjadi di driver printer atau di mesin percetakan.
 * Yang bisa diatur dari sini adalah memilih warna yang konversinya BERSIH:
 * setiap warna berdiri di dalam gamut CMYK dan memakai kanal yang tegas, jadi
 * tidak berubah jadi "hijau kotor" atau abu-abu bernoda saat dicetak. Warna
 * layar yang terang menyala (biru `#2166de`, hijau neon) sengaja TIDAK dipakai —
 * keduanya di luar gamut CMYK dan tercetak kusam.
 *
 * Padanan CMYK di bawah perkiraan untuk profil umum (FOGRA39/GRACoL), bukan
 * nilai pasti — tiap printer sedikit berbeda.
 *
 * Abu-abu sengaja NETRAL (R=G=B), bukan abu kebiruan ala Tailwind: abu netral
 * dikonversi mendekati tinta hitam saja, sedangkan abu berwarna menyalakan
 * ketiga tinta warna dan tercetak dengan semburat.
 */

/** ≈ C100 M85 Y30 K25 — biru korporat: kepala dokumen, judul, bingkai harga. */
export const INK_NAVY = "#0d2959"
/** ≈ C0 M100 Y100 K0 — merah proses: harga dan label varian. */
export const INK_RED = "#d81f26"
/** ≈ K100 — teks utama. Hitam murni, bukan rich black. */
export const INK_BLACK = "#000000"
/** ≈ K65 — teks keterangan. */
export const INK_GRAY = "#595959"
/** ≈ K20 — garis rambut dan bingkai. */
export const INK_HAIRLINE = "#cccccc"
/** ≈ C8 M3 Y0 K2 — latar panel tipis bernada navy. Cukup terang untuk teks hitam. */
export const INK_TINT = "#eef2f8"
/** ≈ C100 M0 Y100 K15 — hijau proses: potongan harga, FPS mulus. */
export const INK_GREEN = "#00843d"
/** ≈ C0 M40 Y100 K0 — kuning-jingga proses: FPS masih layak dimainkan. */
export const INK_AMBER = "#f39200"
