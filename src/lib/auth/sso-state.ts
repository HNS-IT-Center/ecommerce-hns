/**
 * Cookie sementara satu percobaan login SSO: `state`, `nonce`, dan PKCE
 * `code_verifier`. Disimpan sebelum redirect ke SSO, dibaca dan DIBUANG di
 * callback — sukses maupun gagal.
 *
 * - HttpOnly: verifier tidak boleh terbaca skrip di halaman.
 * - SameSite=Lax: callback datang sebagai navigasi top-level dari
 *   auth.hnsitcenter.id, dan Lax tetap mengirim cookie untuk itu. Strict tidak.
 * - Path `/api/auth/sso`: tidak ikut terkirim ke halaman lain mana pun.
 * - 10 menit: cukup untuk mengetik password + OTP di SSO.
 *
 * Tidak ditandatangani, sama seperti `hns_google_state`. Cookie ini tidak
 * memberi hak apa pun — ia hanya mengikat callback ke peramban yang memulai
 * login. Penyerang yang bisa menanam cookie di domain kita sudah punya masalah
 * yang jauh lebih besar daripada alur ini.
 */
import { timingSafeEqual } from "node:crypto"
import type { SsoFlow } from "./sso"

export const SSO_FLOW_COOKIE = "hns_sso_flow"
export const SSO_FLOW_COOKIE_PATH = "/api/auth/sso"
export const SSO_FLOW_MAX_AGE_SECONDS = 10 * 60

export function ssoFlowCookieOptions(maxAge: number = SSO_FLOW_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: SSO_FLOW_COOKIE_PATH,
    maxAge,
  }
}

export function serializeSsoFlow(flow: SsoFlow): string {
  return Buffer.from(JSON.stringify(flow)).toString("base64url")
}

/** `null` kalau cookie tidak ada atau isinya cacat. */
export function parseSsoFlow(raw: string | undefined): SsoFlow | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))
    if (typeof value !== "object" || value === null) return null
    const v = value as Record<string, unknown>
    if (typeof v.state !== "string" || typeof v.nonce !== "string" || typeof v.codeVerifier !== "string") return null
    if (!v.state || !v.nonce || !v.codeVerifier) return null
    return { state: v.state, nonce: v.nonce, codeVerifier: v.codeVerifier }
  } catch {
    return null
  }
}

/**
 * Bandingkan `state` dari callback dengan milik cookie, konstan-waktu.
 *
 * Panjang diperiksa lebih dulu karena `timingSafeEqual` melempar untuk buffer
 * berbeda panjang. Itu membocorkan PANJANG — tidak masalah di sini: panjang
 * `state` selalu 43 karakter dan bukan rahasia.
 */
export function stateMatches(received: string | null, expected: string): boolean {
  if (!received) return false
  const a = Buffer.from(received)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
