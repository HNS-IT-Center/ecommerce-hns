/**
 * Tingkatan akun admin.
 *
 * Union literal, bukan enum Prisma maupun enum TypeScript —
 * docs/06-coding-standards.md §1.4, pola yang sama dipakai `TokenPurpose` di
 * `verification-token.ts`. Kolomnya di database cuma `VARCHAR(16)`, jadi daftar
 * nilai yang sah dipegang di sini.
 */
export type AdminRole = "owner" | "staff"

export const ADMIN_ROLES: readonly AdminRole[] = ["owner", "staff"] as const

/**
 * Label untuk antarmuka. Bahasa Indonesia karena tampil ke staff (CLAUDE.md §7).
 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  staff: "Staff",
}

export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  owner: "Akses penuh, termasuk menghapus akun pelanggan dan mengatur role admin lain.",
  staff: "Mengelola produk, kategori, toko, dan konten. Tidak bisa menghapus akun pelanggan.",
}

/**
 * Nilai apa pun dari database menjadi `AdminRole`.
 *
 * Kolomnya VARCHAR biasa, jadi secara teknis ia bisa berisi string apa saja —
 * hasil UPDATE manual lewat SQL, atau nilai lama kalau daftar role berubah
 * suatu hari. Yang tidak dikenali jatuh ke `staff`, BUKAN `owner`: kalau
 * datanya rusak, jatuh ke izin paling kecil adalah kegagalan yang aman.
 *
 * Perhatikan bedanya dengan `@default("owner")` di skema — default itu berlaku
 * untuk baris yang tidak pernah menyebut role sama sekali (termasuk baris lama
 * saat kolomnya ditambahkan), sedangkan fungsi ini menangani nilai yang ADA
 * tapi tidak dikenali. Dua keadaan berbeda, jadi jawabannya juga berbeda.
 */
export function parseAdminRole(value: string): AdminRole {
  return value === "owner" ? "owner" : "staff"
}

export function isAdminRole(value: string): value is AdminRole {
  return value === "owner" || value === "staff"
}
