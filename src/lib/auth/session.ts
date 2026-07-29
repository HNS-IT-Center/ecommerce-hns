/**
 * Token sesi admin.
 *
 * Memakai Web Crypto (`crypto.subtle`), BUKAN `node:crypto`. Ini bukan selera:
 * middleware Next berjalan di Edge runtime yang tidak punya `node:crypto`, dan
 * middleware-lah yang harus memverifikasi sesi pada setiap permintaan ke
 * /admin. Dengan Web Crypto, fungsi yang sama dipakai middleware, server
 * action, dan route handler tanpa dua implementasi yang bisa menyimpang.
 *
 * Bentuk token: `payloadBase64Url.signatureBase64Url`.
 *
 * Sengaja BUKAN JWT utuh. JWT membawa header berisi `alg`, dan penerima yang
 * mempercayai header itu membuka celah klasik "alg confusion" — penyerang
 * mengganti algoritma menjadi `none` atau menurunkannya. Di sini tidak ada
 * header sama sekali: hanya satu algoritma yang pernah dipakai, ditentukan
 * kode, tidak bisa dipengaruhi token. Isinya tetap ditandatangani dan
 * kedaluwarsa seperti JWT, tanpa permukaan serangan itu.
 *
 * Isi payload tidak dienkripsi, hanya ditandatangani — jangan menaruh apa pun
 * yang rahasia di dalamnya. Yang disimpan cukup id, email, dan waktu
 * kedaluwarsa; izin sesungguhnya selalu dicek ulang ke tabel User.
 */

export type SessionPayload = {
  /** id user */
  sub: string
  email: string
  /** epoch detik */
  exp: number
}

export const SESSION_COOKIE = "hns_admin_session"

/** 7 hari. Cukup lama supaya PIC tidak login berulang kali dalam satu minggu kerja. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

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

// Tipe kembaliannya ditulis `Uint8Array<ArrayBuffer>`, bukan `Uint8Array` saja:
// sejak TypeScript 5.7 tipe itu diparameterisasi, dan `crypto.subtle` menolak
// varian yang bisa berlandaskan SharedArrayBuffer.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const s = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="))
  const out = new Uint8Array(new ArrayBuffer(s.length))
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i)
  return out
}

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
export async function signSession(
  payload: Omit<SessionPayload, "exp">,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(full)))
  const sig = await crypto.subtle.sign("HMAC", await key(), encoder.encode(body))
  return `${body}.${toBase64Url(new Uint8Array(sig))}`
}

/**
 * Kembalikan payload kalau tanda tangannya sah DAN belum kedaluwarsa.
 * Selain itu `null` — tidak pernah melempar untuk token yang cacat, karena
 * token cacat adalah masukan yang wajar dari luar, bukan kesalahan program.
 */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null

  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  let valid: boolean
  try {
    valid = await crypto.subtle.verify("HMAC", await key(), fromBase64Url(sig), encoder.encode(body))
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/** Atribut cookie sesi. `secure` menyala di produksi, mati di localhost http. */
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  }
}
