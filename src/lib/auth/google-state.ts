/**
 * Parameter `state` OAuth: membawa tujuan setelah login (docs/09 §9.3) DAN
 * mencegah CSRF pada callback.
 *
 * Nonce acak disimpan di cookie sementara `hns_google_state` sebelum
 * redirect ke Google, lalu dicocokkan dengan nonce yang Google kembalikan di
 * `state` saat callback. Tanpa ini, penyerang bisa memicu callback dengan
 * `code` miliknya sendiri dan membuat korban "login" sebagai akun penyerang
 * (session fixation).
 *
 * `state` sendiri berbentuk `${nonce}.${nextPathBase64Url}` — nonce di depan
 * supaya perbandingan konstan-waktu hanya perlu menyentuh bagian itu.
 */

export const GOOGLE_STATE_COOKIE = "hns_google_state"
export const GOOGLE_STATE_MAX_AGE_SECONDS = 10 * 60

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const s = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  return s
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function buildState(nextPath: string): { state: string; nonce: string } {
  const nonce = randomNonce()
  const state = `${nonce}.${toBase64Url(nextPath)}`
  return { state, nonce }
}

/** `null` kalau `state` cacat atau nonce-nya tidak cocok dengan cookie. */
export function parseState(state: string | null, expectedNonce: string | undefined): { nextPath: string } | null {
  if (!state || !expectedNonce) return null

  const separatorIndex = state.indexOf(".")
  if (separatorIndex === -1) return null

  const nonce = state.slice(0, separatorIndex)
  const encodedNext = state.slice(separatorIndex + 1)

  if (nonce.length !== expectedNonce.length) return null
  // Perbandingan sederhana cukup di sini: nonce ini sekali pakai dan
  // kedaluwarsa dalam 10 menit, bukan secret jangka panjang — bukan target
  // yang bernilai untuk timing attack.
  if (nonce !== expectedNonce) return null

  try {
    return { nextPath: fromBase64Url(encodedNext) }
  } catch {
    return null
  }
}
