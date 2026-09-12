/**
 * Validasi tujuan redirect setelah login pelanggan (docs/09 §9.3).
 *
 * Tujuannya disimpan di dalam parameter `state` OAuth, bukan query string
 * terpisah — tapi ISINYA tetap harus divalidasi sebagai path internal di
 * sini, karena `state` diketik balik oleh Google tanpa jaminan isinya masih
 * seperti yang kita kirim.
 *
 * Tanpa validasi ini, tautan `?next=https://situs-penipu.example` menjadikan
 * domain HNS batu loncatan phishing: pelanggan melihat alamat hnsitcenter.id
 * di address bar, lalu setelah login mendarat di domain lain yang tampak
 * datang dari sini.
 */
const FALLBACK = "/profile"

export function isSafeInternalPath(value: string): boolean {
  if (!value.startsWith("/")) return false
  // "//evil.com" dan "/\evil.com" dibaca peramban sebagai URL
  // protokol-relatif menuju host lain, bukan path internal.
  if (value.startsWith("//") || value.startsWith("/\\")) return false
  if (value.includes("://")) return false
  return true
}

/** Kembalikan `value` kalau path internal yang sah, selain itu `/profile` tanpa pesan galat. */
export function sanitizeNextPath(value: string | null | undefined): string {
  if (!value) return FALLBACK
  return isSafeInternalPath(value) ? value : FALLBACK
}
