/**
 * Token sesi pelanggan.
 *
 * Salinan pola dari `lib/auth/session.ts` (sesi admin), dengan cookie dan
 * kunci identitas yang berbeda — lihat docs/09-google-oauth-setup.md §1 kenapa
 * dua sesi ini sengaja tidak boleh saling menyentuh. Web Crypto dipakai untuk
 * alasan yang sama: `proxy.ts` (Edge runtime) harus bisa memverifikasi cookie
 * ini tanpa `node:crypto`.
 *
 * Bentuk token dan alasan "bukan JWT utuh" sama seperti sesi admin — lihat
 * komentar di `session.ts`.
 */

export type CustomerSessionPayload = {
  /** id customer */
  sub: string
  email: string
  /** Waktu terbit, epoch detik. Dibandingkan dengan `sessionsRevokedAt`. */
  iat: number
  /** epoch detik */
  exp: number
}

export const CUSTOMER_SESSION_COOKIE = "hns_customer_session"

/** 30 hari. Lebih lama dari sesi admin — akun pelanggan bukan akses sensitif. */
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function secret(): string {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET belum diisi (minimal 32 karakter). Tanpa itu cookie sesi tidak bisa ditandatangani."
    )
  }
  return value
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const s = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i)
  return out
}

// Domain HMAC terpisah dari sesi admin lewat prefix pada data yang
// ditandatangani (bukan kunci berbeda — `AUTH_SECRET` yang sama dipakai
// keduanya). Tanpa prefix ini, token sesi admin yang bocor bisa ditempel
// begitu saja di cookie `hns_customer_session` dan lolos verifikasi karena
// bentuk payload keduanya kebetulan mirip (sub/email/iat/exp).
const DOMAIN_PREFIX = "customer:"

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

/** Tanda tangani payload jadi token siap simpan di cookie. */
export async function signCustomerSession(
  payload: Omit<CustomerSessionPayload, "iat" | "exp">,
  maxAgeSeconds: number = CUSTOMER_SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const full: CustomerSessionPayload = {
    ...payload,
    iat: now,
    exp: now + maxAgeSeconds,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(full)))
  const sig = await crypto.subtle.sign("HMAC", await key(), encoder.encode(DOMAIN_PREFIX + body))
  return `${body}.${toBase64Url(new Uint8Array(sig))}`
}

/**
 * Kembalikan payload kalau tanda tangannya sah DAN belum kedaluwarsa.
 * `null` untuk token cacat — itu masukan wajar dari luar, bukan galat program.
 */
export async function verifyCustomerSession(
  token: string | undefined
): Promise<CustomerSessionPayload | null> {
  if (!token) return null

  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  let valid: boolean
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await key(),
      fromBase64Url(sig),
      encoder.encode(DOMAIN_PREFIX + body)
    )
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as CustomerSessionPayload
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null
    if (typeof payload.iat !== "number") return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/** Atribut cookie sesi. `secure` menyala di produksi, mati di localhost http. */
export function customerSessionCookieOptions(maxAgeSeconds: number = CUSTOMER_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  }
}
