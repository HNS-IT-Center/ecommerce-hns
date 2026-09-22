/**
 * Aturan TINGKAT izin — bagian dari lapisan izin yang boleh dipakai klien.
 *
 * `permissions.ts` memakai `import "server-only"` karena ia menyentuh database
 * dan env. Editor peran (`manajemen-user/view.tsx`) adalah Client Component,
 * tapi butuh aturan yang sama persis untuk memutuskan level apa yang sah bagi
 * sebuah izin saat orang menekan kontrol massal di induk.
 *
 * Menyalin aturannya ke komponen akan menghasilkan dua salinan yang hanya sama
 * di hari keduanya ditulis — pola yang sudah pernah menggigit di berkas ini
 * (lihat catatan `landingPathFor` soal dua daftar untuk satu pertanyaan). Jadi
 * yang murni logika dipindah ke sini, dan `permissions.ts` memakainya kembali.
 *
 * Berkas ini sengaja TIDAK tahu apa-apa soal `AdminPage`, database, atau user —
 * hanya tentang tingkat. Itu yang membuatnya aman dikirim ke peramban.
 */

/** Level akses satu halaman untuk satu peran. Urutan menaik: none < view < edit. */
export type AccessLevel = "none" | "view" | "edit"

export const ACCESS_ORDER: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 }

/**
 * Tingkat mana yang BERARTI untuk sebuah izin.
 *
 * Tidak semua izin punya arti di ketiga tingkat. Sebagian cuma ya-tidak
 * (`quotation-sales`: namanya tercetak atau tidak), sebagian cuma bisa dibaca
 * (`logs`). Menampilkan tiga tombol untuk keduanya berarti menyediakan tombol
 * yang kalau ditekan tidak mengubah apa pun — dan itu lebih buruk daripada
 * tidak ada tombolnya, karena orang mengira izinnya sudah diberikan.
 */
export type LevelMode =
  /** Halaman biasa: Tak ada / Lihat / Edit. */
  | "view-edit"
  /** Kemampuan ya-tidak; hanya `edit` yang pernah diperiksa server. */
  | "edit-only"
  /** Halaman atau kolom yang cuma bisa dibaca; hanya `view` yang berarti. */
  | "view-only"

/** Level tertinggi yang berarti untuk sebuah mode. */
export function levelTertinggiUntukMode(mode: LevelMode): AccessLevel {
  return mode === "view-only" ? "view" : "edit"
}

/**
 * Level yang sah untuk sebuah mode, dari level apa pun yang diminta.
 *
 * Dipakai kontrol massal di editor peran: menekan "Lihat" pada induk berarti
 * "beri tingkat terkecil yang masih berarti" bagi tiap anak — dan untuk anak
 * yang cuma ya-tidak, "Lihat" tidak berarti apa-apa, jadi jawabannya "Tak ada".
 * Tanpa penyesuaian ini, satu tekan pada induk menanam level yang tidak pernah
 * dibaca siapa pun ke dalam `role_permissions`.
 */
export function levelSahUntukMode(mode: LevelMode, diminta: AccessLevel): AccessLevel {
  if (diminta === "none") return "none"
  if (mode === "edit-only") return diminta === "edit" ? "edit" : "none"
  if (mode === "view-only") return "view"
  return diminta
}
