/**
 * Alamat "kembali" untuk `/verify/[code]` dan `/dokumentasi-rakitan/[code]`.
 *
 * Halaman detail quotation dibuka dari dua tempat: daftar kasir (`/verify`) dan
 * daftar admin Quotation & Penjualan (`/admin/quotation`). Tanpa penanda, tombol
 * kembali selalu ke `/verify` dan admin "tersesat" ke alat kasir. Admin
 * meneruskan alamat daftarnya (lengkap dengan saringan & halaman) lewat
 * `?kembali=`.
 *
 * Nilainya datang dari URL, jadi bisa diisi siapa saja. Hanya alamat
 * `/admin/quotation` di domain sendiri yang diterima — selain itu diabaikan,
 * supaya parameter ini tidak bisa dipakai mengalihkan ke situs lain
 * (`//evil.com`, `https://…`, `/\evil.com`).
 */

export const RETURN_PARAM = "kembali"

const ALLOWED_PATH = "/admin/quotation"
const MAX_LENGTH = 500
const BASE = "http://hns.invalid"

export type ReturnTarget = { href: string; label: string }

/** `null` kalau parameternya kosong atau tidak diizinkan. */
export function parseReturnTarget(raw: string | string[] | undefined): ReturnTarget | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || value.length > MAX_LENGTH) return null
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null

  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE || url.pathname !== ALLOWED_PATH) return null

  return { href: `${url.pathname}${url.search}`, label: "Kembali ke Quotation & Penjualan" }
}

/** Tempelkan `?kembali=` ke sebuah path; tanpa target, path dikembalikan apa adanya. */
export function withReturnTarget(path: string, target: ReturnTarget | string | null): string {
  if (!target) return path
  const href = typeof target === "string" ? target : target.href
  return `${path}?${RETURN_PARAM}=${encodeURIComponent(href)}`
}
