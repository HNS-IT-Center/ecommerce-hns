/**
 * Alur OAuth Google untuk akun pelanggan. Rancangan lengkap:
 * docs/09-google-oauth-setup.md §8.
 *
 * Kripto dan pemeriksaan klaim `id_token` diserahkan ke `jose`
 * (`createRemoteJWKSet` + `jwtVerify`), bukan ditulis sendiri. Alasannya
 * ditulis panjang di docs/09 §8: bagian yang paling mudah salah bukan alur
 * OAuth-nya, melainkan ROTASI KUNCI — Google mengganti kunci penandatanganan
 * secara berkala, dan implementasi yang meng-cache JWKS tanpa menanganinya
 * berjalan normal berminggu-minggu lalu mendadak menolak semua login.
 * `createRemoteJWKSet` menangani ini lewat `cooldownDuration`.
 */
import { createRemoteJWKSet, jwtVerify } from "jose"

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

// Scope seminimal mungkin — lihat docs/09 §4. Menambah scope lain
// (Gmail/Drive/Kontak) memindahkan aplikasi ke kategori sensitive/restricted
// di Google, yang mewajibkan tinjauan keamanan berbayar dan berbulan-bulan.
const GOOGLE_SCOPES = ["openid", "email", "profile"]

function clientId(): string {
  const value = process.env.GOOGLE_CLIENT_ID
  if (!value) {
    throw new Error(
      "GOOGLE_CLIENT_ID belum diisi. Lihat docs/09-google-oauth-setup.md untuk cara mendapatkannya."
    )
  }
  return value
}

function clientSecret(): string {
  const value = process.env.GOOGLE_CLIENT_SECRET
  if (!value) {
    throw new Error(
      "GOOGLE_CLIENT_SECRET belum diisi. Lihat docs/09-google-oauth-setup.md untuk cara mendapatkannya."
    )
  }
  return value
}

/** `/api/auth/google/callback` — path ini yang didaftarkan di Google Console, BUKAN /api/auth/callback/google (konvensi Auth.js). Lihat docs/09 §5. */
function redirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`
}

/** Bangun URL yang dituju tombol "Masuk dengan Google". */
export function buildGoogleAuthUrl(origin: string, state: string): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT)
  url.searchParams.set("client_id", clientId())
  url.searchParams.set("redirect_uri", redirectUri(origin))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "))
  url.searchParams.set("state", state)
  // Selalu tampilkan pemilih akun — tanpa ini, pelanggan yang sudah pernah
  // login sekali langsung ditukar tokennya tanpa kesempatan ganti akun
  // Google kalau device-nya dipakai bersama.
  url.searchParams.set("prompt", "select_account")
  return url.toString()
}

export type GoogleIdentity = {
  /** Subject claim (`sub`) — kunci identitas, lihat docs/09 §8. */
  googleSub: string
  email: string
  name: string
}

/**
 * Tukar `code` dari callback Google dengan `id_token`, lalu verifikasi
 * tanda tangan, `aud`, `iss`, dan masa berlakunya. Token akses/refresh yang
 * ikut dikembalikan Google TIDAK disimpan — dipakai sekali di sini lalu
 * dibuang, sesuai docs/09 §8.
 */
export async function exchangeCodeForIdentity(code: string, origin: string): Promise<GoogleIdentity> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error(`Gagal menukar kode dengan token Google (status ${tokenResponse.status}).`)
  }

  const tokenBody = (await tokenResponse.json()) as { id_token?: string }
  if (!tokenBody.id_token) {
    throw new Error("Respons token Google tidak berisi id_token.")
  }

  return verifyGoogleIdToken(tokenBody.id_token)
}

// Dibuat sekali di scope modul, bukan per-request: `createRemoteJWKSet`
// menyimpan cache JWKS di closure-nya sendiri dan menanganinya menerima
// `JWKSNoMatchingKey` sebagai pemicu pengambilan ulang. Membuat instance baru
// tiap request akan mengambil ulang JWKS setiap kali dan meniadakan caching.
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
  cooldownDuration: 30_000,
})

async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, googleJwks, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId(),
  })

  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("id_token Google tidak memuat klaim sub.")
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new Error("id_token Google tidak memuat klaim email.")
  }
  if (payload.email_verified !== true) {
    throw new Error("Email akun Google ini belum terverifikasi.")
  }

  const name = typeof payload.name === "string" && payload.name ? payload.name : payload.email

  return { googleSub: payload.sub, email: payload.email, name }
}
