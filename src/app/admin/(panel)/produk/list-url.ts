/**
 * Penyusun URL bolak-balik antara daftar `/admin/produk` dan form produk.
 *
 * Staff biasanya menyunting produk dari daftar yang sudah disaring (mis.
 * "belum ada gambar"). Tanpa ini, setiap simpan melempar mereka ke daftar
 * polos dan saringannya harus dipasang ulang untuk produk berikutnya.
 *
 * Saringan dibawa lewat URL (`?back=`), bukan sessionStorage: dua tab dengan
 * saringan berbeda tidak saling menimpa, dan tautan edit yang dibuka di tab
 * baru tetap tahu jalan pulangnya.
 *
 * Dipakai Server Component maupun Client Component, jadi berkas ini sengaja
 * murni — tanpa `"use client"` dan tanpa impor dari server.
 */

export const LIST_PATH = "/admin/produk"

/** Parameter di URL form yang membawa query daftar asal. */
export const BACK_PARAM = "back"

/** Parameter di URL daftar yang menandai baris untuk disorot sebentar. */
export const HIGHLIGHT_PARAM = "highlight"

/**
 * Parameter yang dikenali daftar produk. Isi `back` disaring ke daftar ini
 * saja, sehingga URL tujuan SELALU `/admin/produk?...` — tidak ada nilai
 * kiriman yang bisa membelokkan redirect ke tempat lain.
 */
const LIST_KEYS = [
  "q",
  "page",
  "sort",
  "order",
  "status_filter",
  "type_filter",
  "flag_filter",
  "category_filter",
  "accurate_filter",
] as const

/** Ambil hanya parameter daftar yang dikenal dari query string mentah. */
export function sanitizeListQuery(raw: string | null | undefined): string {
  if (!raw) return ""
  const source = new URLSearchParams(raw)
  const clean = new URLSearchParams()
  for (const key of LIST_KEYS) {
    const value = source.get(key)
    if (value) clean.set(key, value)
  }
  return clean.toString()
}

/** URL daftar dengan saringan asal, opsional menyorot satu produk. */
export function listHref(query: string, highlightId?: number): string {
  const params = new URLSearchParams(sanitizeListQuery(query))
  if (highlightId) params.set(HIGHLIGHT_PARAM, String(highlightId))
  const qs = params.toString()
  return qs ? `${LIST_PATH}?${qs}` : LIST_PATH
}

/** URL form (edit atau baru) yang membawa saringan daftar saat ini. */
export function formHref(target: number | "baru", currentQuery: string): string {
  const back = sanitizeListQuery(currentQuery)
  const base = `${LIST_PATH}/${target}`
  return back ? `${base}?${BACK_PARAM}=${encodeURIComponent(back)}` : base
}
