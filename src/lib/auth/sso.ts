/**
 * Login STAFF lewat HNS SSO (auth.hnsitcenter.id) — OpenID Connect,
 * authorization code + PKCE S256. Rancangan & alasannya: docs/19-sso-staff.md.
 *
 * Sengaja memakai `jose` + `fetch`, pola yang sama dengan login Google
 * pelanggan (`lib/auth/google.ts`), bukan library klien OIDC tambahan. Bagian
 * yang paling mudah salah — verifikasi tanda tangan dan rotasi kunci — tetap
 * diserahkan ke `jose` (`createRemoteJWKSet` mengambil ulang JWKS saat menemui
 * `kid` yang tidak dikenal). Yang ditulis di sini hanya alurnya.
 *
 * Token dari SSO (access/refresh/id token) TIDAK disimpan. Dipakai sekali untuk
 * membuktikan siapa orangnya, lalu ecommerce menerbitkan sesi admin miliknya
 * sendiri (`createSession`). Konsekuensinya — staff yang dinonaktifkan di SSO
 * tetap masuk sampai sesinya habis — ditekan dengan umur sesi 12 jam
 * (`SSO_SESSION_MAX_AGE_SECONDS`) sampai back-channel logout dipasang.
 */
import { createHash, randomBytes } from "node:crypto"
import { createRemoteJWKSet, jwtVerify } from "jose"
import { env } from "@/config/env"

/**
 * Umur sesi admin yang lahir dari login SSO: 12 jam, sama dengan batas
 * absolut sesi SSO. Lebih pendek dari sesi password (7 hari) dengan sengaja —
 * lihat docs/19 §4.
 */
export const SSO_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

const SCOPES = "openid profile email"
const FETCH_TIMEOUT_MS = 10_000
const DISCOVERY_TTL_MS = 5 * 60 * 1000
/** Toleransi selisih jam antar server, batas yang ditetapkan SSO HNS. */
const CLOCK_TOLERANCE_SECONDS = 30

export type SsoConfig = {
  issuer: string
  clientId: string
  clientSecret: string
  redirectUri: string
  postLogoutRedirectUri: string
}

/**
 * Konfigurasi SSO, atau `null` kalau BELUM LENGKAP.
 *
 * Kelimanya harus ada bersamaan. Setengah terisi diperlakukan sama dengan
 * kosong — lebih baik tombolnya tidak tampil daripada tampil lalu gagal di
 * tengah jalan dengan galat yang tidak dimengerti staff.
 */
export function ssoConfig(): SsoConfig | null {
  const issuer = env.SSO_ISSUER
  const clientId = env.SSO_CLIENT_ID
  const clientSecret = env.SSO_CLIENT_SECRET
  const redirectUri = env.SSO_REDIRECT_URI
  const postLogoutRedirectUri = env.SSO_POST_LOGOUT_REDIRECT_URI
  if (!issuer || !clientId || !clientSecret || !redirectUri || !postLogoutRedirectUri) return null
  // Issuer dibandingkan PERSIS dengan klaim `iss`, jadi garis miring penutup
  // yang tidak sengaja terketik di env akan menolak semua login.
  return { issuer: issuer.replace(/\/+$/, ""), clientId, clientSecret, redirectUri, postLogoutRedirectUri }
}

export function isSsoEnabled(): boolean {
  return ssoConfig() !== null
}

/**
 * Galat alur SSO. `reason` adalah kunci pesan di halaman `/login/error`
 * — detail teknisnya masuk log server, tidak ke layar.
 */
export class SsoError extends Error {
  constructor(
    readonly reason: "sso_network" | "sso_token",
    message: string,
  ) {
    super(message)
    this.name = "SsoError"
  }
}

// ---------------------------------------------------------------------------
// Discovery & JWKS
// ---------------------------------------------------------------------------

type Discovery = {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  jwks_uri: string
}

let discoveryCache: { issuer: string; value: Discovery; expiresAt: number } | null = null

function isDiscovery(value: unknown): value is Discovery {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.issuer === "string" &&
    typeof v.authorization_endpoint === "string" &&
    typeof v.token_endpoint === "string" &&
    typeof v.jwks_uri === "string"
  )
}

async function discover(config: SsoConfig): Promise<Discovery> {
  const now = Date.now()
  if (discoveryCache && discoveryCache.issuer === config.issuer && discoveryCache.expiresAt > now) {
    return discoveryCache.value
  }

  let body: unknown
  try {
    const res = await fetch(`${config.issuer}/.well-known/openid-configuration`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`status ${res.status}`)
    body = await res.json()
  } catch (error) {
    throw new SsoError("sso_network", `Discovery SSO gagal: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!isDiscovery(body)) throw new SsoError("sso_network", "Dokumen discovery SSO tidak lengkap.")
  // Wajib sama persis (OIDC Discovery §4.3): discovery yang menyebut issuer lain
  // berarti kita sedang bicara dengan server yang salah.
  if (body.issuer !== config.issuer) {
    throw new SsoError("sso_network", `Issuer discovery (${body.issuer}) berbeda dengan SSO_ISSUER (${config.issuer}).`)
  }

  discoveryCache = { issuer: config.issuer, value: body, expiresAt: now + DISCOVERY_TTL_MS }
  return body
}

// Satu instance per alamat JWKS, disimpan di scope modul — alasan yang sama
// dengan `googleJwks`: instance baru per permintaan meniadakan cache-nya.
const jwksByUri = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function jwksFor(uri: string) {
  let jwks = jwksByUri.get(uri)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(uri), { cooldownDuration: 30_000, timeoutDuration: FETCH_TIMEOUT_MS })
    jwksByUri.set(uri, jwks)
  }
  return jwks
}

// ---------------------------------------------------------------------------
// Alur login
// ---------------------------------------------------------------------------

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Nilai acak sekali pakai untuk satu percobaan login.
 *
 * 32 byte → 43 karakter base64url: tepat batas bawah pola `code_verifier` SSO
 * (`[A-Za-z0-9-._~]{43,128}`), dan cukup lebar untuk `state`/`nonce`.
 */
export type SsoFlow = {
  state: string
  nonce: string
  codeVerifier: string
}

export function createSsoFlow(): SsoFlow {
  return {
    state: base64Url(randomBytes(32)),
    nonce: base64Url(randomBytes(32)),
    codeVerifier: base64Url(randomBytes(32)),
  }
}

function codeChallengeFor(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest())
}

/** URL halaman login SSO untuk satu percobaan login. */
export async function buildSsoAuthorizationUrl(config: SsoConfig, flow: SsoFlow): Promise<string> {
  const discovery = await discover(config)
  const url = new URL(discovery.authorization_endpoint)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", SCOPES)
  url.searchParams.set("code_challenge", codeChallengeFor(flow.codeVerifier))
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", flow.state)
  url.searchParams.set("nonce", flow.nonce)
  return url.toString()
}

export type SsoIdentity = {
  /** UUID stabil — kunci penautan ke `users.sso_sub`. */
  sub: string
  /** Sudah dinormalisasi: huruf kecil, tanpa spasi tepi. */
  email: string
  name: string
}

/**
 * `client_secret_basic` (RFC 6749 §2.3.1): id & secret masing-masing di-encode
 * form-urlencoded DULU sebelum digabung dan di-base64. Secret berisi karakter
 * seperti `+` atau `:` akan ditolak `invalid_client` kalau langkah itu dilewati.
 */
function basicAuthHeader(config: SsoConfig): string {
  const id = encodeURIComponent(config.clientId)
  const secret = encodeURIComponent(config.clientSecret)
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`
}

/**
 * Tukar `code` dari callback dengan `id_token`, lalu verifikasi.
 *
 * `code` berlaku 60 detik dan sekali pakai; memakainya dua kali membuat SSO
 * mencabut semua token yang terbit darinya. Karena itu fungsi ini tidak pernah
 * mencoba ulang.
 */
export async function exchangeSsoCode(config: SsoConfig, code: string, flow: SsoFlow): Promise<SsoIdentity> {
  const discovery = await discover(config)

  let tokenBody: unknown
  let status: number
  try {
    const res = await fetch(discovery.token_endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(config),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        code_verifier: flow.codeVerifier,
      }),
    })
    status = res.status
    tokenBody = await res.json().catch(() => null)
  } catch (error) {
    throw new SsoError("sso_network", `Token endpoint SSO tidak terjangkau: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (status !== 200) {
    // `error` dari SSO (`invalid_grant`, `invalid_client`, …) cukup untuk
    // diagnosis di log; `error_description` tidak memuat rahasia.
    const detail =
      typeof tokenBody === "object" && tokenBody !== null
        ? JSON.stringify({
            error: (tokenBody as Record<string, unknown>).error,
            error_description: (tokenBody as Record<string, unknown>).error_description,
          })
        : "(tanpa body)"
    throw new SsoError("sso_token", `Penukaran code ditolak SSO (status ${status}): ${detail}`)
  }

  const idToken =
    typeof tokenBody === "object" && tokenBody !== null ? (tokenBody as Record<string, unknown>).id_token : undefined
  if (typeof idToken !== "string" || !idToken) {
    throw new SsoError("sso_token", "Respons token SSO tidak berisi id_token.")
  }

  return verifySsoIdToken(config, discovery, idToken, flow.nonce)
}

async function verifySsoIdToken(
  config: SsoConfig,
  discovery: Discovery,
  idToken: string,
  expectedNonce: string,
): Promise<SsoIdentity> {
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"]
  try {
    // `algorithms` dikunci ke RS256: tanpa itu, token bertanda tangan algoritma
    // lain yang kebetulan didukung kunci di JWKS ikut diterima.
    const verified = await jwtVerify(idToken, jwksFor(discovery.jwks_uri), {
      issuer: config.issuer,
      audience: config.clientId,
      algorithms: ["RS256"],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
      requiredClaims: ["sub", "exp", "iat", "nonce"],
    })
    payload = verified.payload
  } catch (error) {
    throw new SsoError("sso_token", `id_token SSO tidak sah: ${error instanceof Error ? error.message : String(error)}`)
  }

  // `nonce` mengikat id_token ke percobaan login INI — tanpa pemeriksaan ini,
  // id_token curian dari percobaan lain bisa diputar ulang.
  if (payload.nonce !== expectedNonce) {
    throw new SsoError("sso_token", "nonce id_token SSO tidak cocok.")
  }
  // `azp`, kalau ada, wajib client kita sendiri (OIDC Core §3.1.3.7).
  if (payload.azp !== undefined && payload.azp !== config.clientId) {
    throw new SsoError("sso_token", "azp id_token SSO bukan client ini.")
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new SsoError("sso_token", "id_token SSO tidak memuat sub.")
  }
  if (typeof payload.email !== "string" || !payload.email) {
    throw new SsoError("sso_token", "id_token SSO tidak memuat email — pastikan scope email dicentang di SSO.")
  }

  const email = payload.email.trim().toLowerCase()
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email
  return { sub: payload.sub, email, name }
}
