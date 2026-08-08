/**
 * Helper slug — sengaja berdiri sendiri, TANPA dependensi apa pun.
 *
 * Dipakai dari dua sisi: server action (`atribut-brand/actions.ts`) dan
 * komponen klien (form brand, untuk pratinjau). Kalau ia tinggal di modul yang
 * mengimpor Prisma, sisi klien akan ikut menyeret driver database ke bundel
 * browser dan build gagal.
 */

/**
 * "Gaming Mouse!" → "gaming-mouse".
 *
 * Rangkaian `-` dirapatkan dan dipangkas di kedua ujung supaya "A -- B "
 * tidak menjadi "a---b-".
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
