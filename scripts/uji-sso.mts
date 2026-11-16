/**
 * Uji login staff lewat HNS SSO — docs/19-sso-staff.md §7.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-sso.mts
 *
 * Yang diuji adalah fungsi & route ASLI, bukan salinannya. SSO-nya TIRUAN:
 * server http kecil di 127.0.0.1 yang menyajikan discovery, JWKS, dan token
 * endpoint, dan menandatangani id_token dengan kunci RSA buatan skrip ini.
 * Dengan begitu jalur penolakan (nonce salah, aud salah, kunci asing, …)
 * benar-benar dijalankan — hal yang tidak mungkin dicoba terhadap SSO
 * sungguhan. Login end-to-end dengan SSO sungguhan TETAP harus dicoba manusia
 * di peramban (§7 bagian "Belum teruji di sini").
 *
 * Menulis ke DATABASE_URL — WAJIB database lokal Docker (docs/16). Skrip
 * menolak jalan kalau host-nya bukan 127.0.0.1/localhost. Akun uji memakai
 * awalan ZZ TEST dan dihapus di akhir, sukses maupun gagal.
 */
import { createHash } from "node:crypto"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { spawnSync } from "node:child_process"
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose"

try {
  process.loadEnvFile(".env.local")
} catch {
  // CI: env datang dari lingkungan.
}

// ---------------------------------------------------------------------------
// Mode anak: env SSO kosong → aplikasi tetap start, fitur mati.
// ---------------------------------------------------------------------------
if (process.argv.includes("--mode=env-kosong")) {
  for (const k of ["SSO_ISSUER", "SSO_CLIENT_ID", "SSO_CLIENT_SECRET", "SSO_REDIRECT_URI", "SSO_POST_LOGOUT_REDIRECT_URI"]) {
    process.env[k] = ""
  }
  const { isSsoEnabled } = await import("../src/lib/auth/sso.ts")
  const { GET } = await import("../src/app/api/auth/sso/login/route.ts")
  const res = await GET()
  console.log(JSON.stringify({ enabled: isSsoEnabled(), location: res.headers.get("location") }))
  process.exit(0)
}

const dbHost = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1]
if (dbHost !== "127.0.0.1" && dbHost !== "localhost") {
  console.error(`DITOLAK: DATABASE_URL menunjuk "${dbHost}", bukan database lokal Docker.`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// SSO tiruan
// ---------------------------------------------------------------------------
const CLIENT_ID = "uji-ecommerce-dev"
const CLIENT_SECRET = "rahasia+uji:dengan/karakter=aneh"

const { privateKey, publicKey } = await generateKeyPair("RS256")
const { privateKey: kunciAsing } = await generateKeyPair("RS256")
const jwk = { ...(await exportJWK(publicKey)), kid: "kunci-uji", alg: "RS256", use: "sig" }

type TokenMode =
  | "ok"
  | "nonce-salah"
  | "aud-salah"
  | "azp-salah"
  | "kedaluwarsa"
  | "kunci-asing"
  | "tanpa-email"
  | "invalid-grant"

let tokenMode: TokenMode = "ok"
let idTokenClaims: { sub: string; email: string; name: string } = { sub: "", email: "", name: "" }
/** code_challenge per code, dicatat saat "authorize" disimulasikan. */
const challengeByCode = new Map<string, { challenge: string; nonce: string }>()
let lastBasicAuth = ""

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  let s = ""
  for await (const chunk of req) s += chunk
  return s
}

let issuer = ""

async function signIdToken(nonce: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims: JWTPayload = {
    nonce: tokenMode === "nonce-salah" ? "nonce-lain" : nonce,
    azp: tokenMode === "azp-salah" ? "client-lain" : CLIENT_ID,
    sid: "sid-uji",
    name: idTokenClaims.name,
    ...(tokenMode === "tanpa-email" ? {} : { email: idTokenClaims.email, email_verified: true }),
  }
  const exp = tokenMode === "kedaluwarsa" ? now - 120 : now + 600
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "kunci-uji" })
    .setIssuer(issuer)
    .setAudience(tokenMode === "aud-salah" ? "client-lain" : CLIENT_ID)
    .setSubject(idTokenClaims.sub)
    .setIssuedAt(tokenMode === "kedaluwarsa" ? now - 720 : now)
    .setExpirationTime(exp)
    .sign(tokenMode === "kunci-asing" ? kunciAsing : privateKey)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", issuer)
  if (url.pathname === "/.well-known/openid-configuration") {
    return json(res, 200, {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    })
  }
  if (url.pathname === "/.well-known/jwks.json") return json(res, 200, { keys: [jwk] })
  if (url.pathname === "/oauth/token" && req.method === "POST") {
    lastBasicAuth = req.headers.authorization ?? ""
    const expectedAuth = `Basic ${Buffer.from(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`).toString("base64")}`
    if (lastBasicAuth !== expectedAuth) return json(res, 401, { error: "invalid_client" })
    if (tokenMode === "invalid-grant") return json(res, 400, { error: "invalid_grant", error_description: "code kedaluwarsa" })

    const form = new URLSearchParams(await readBody(req))
    const entry = challengeByCode.get(form.get("code") ?? "")
    if (!entry) return json(res, 400, { error: "invalid_grant" })
    const verifier = form.get("code_verifier") ?? ""
    const challenge = createHash("sha256").update(verifier).digest("base64url")
    if (challenge !== entry.challenge) return json(res, 400, { error: "invalid_grant", error_description: "PKCE gagal" })
    if (form.get("grant_type") !== "authorization_code") return json(res, 400, { error: "unsupported_grant_type" })
    if (form.get("redirect_uri") !== process.env.SSO_REDIRECT_URI) return json(res, 400, { error: "invalid_grant" })

    return json(res, 200, {
      access_token: "akses-uji",
      token_type: "Bearer",
      expires_in: 600,
      id_token: await signIdToken(entry.nonce),
    })
  }
  json(res, 404, { error: "not_found" })
})

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

// Env WAJIB diset sebelum modul aplikasi diimpor — `config/env.ts` di-parse
// sekali saat dimuat. Nilai .env.local (bisa jadi client sungguhan) ditimpa.
process.env.SSO_ISSUER = issuer
process.env.SSO_CLIENT_ID = CLIENT_ID
process.env.SSO_CLIENT_SECRET = CLIENT_SECRET
process.env.SSO_REDIRECT_URI = "http://localhost:3000/api/auth/sso/callback"
process.env.SSO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/login"

const { NextRequest } = await import("next/server")
const sso = await import("../src/lib/auth/sso.ts")
const { resolveStaffForSso } = await import("../src/lib/auth/sso-link.ts")
const { serializeSsoFlow, parseSsoFlow, stateMatches } = await import("../src/lib/auth/sso-state.ts")
const { signSession, verifySession, sessionCookieOptions } = await import("../src/lib/auth/session.ts")
const loginRoute = await import("../src/app/api/auth/sso/login/route.ts")
const callbackRoute = await import("../src/app/api/auth/sso/callback/route.ts")
const { getPrisma } = await import("../src/lib/prisma/client.ts")

// ---------------------------------------------------------------------------
// Kerangka uji
// ---------------------------------------------------------------------------
let lolos = 0
const gagal: string[] = []
function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) {
    lolos += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${detail ? `  — ${detail}` : ""}`)
  }
}
async function harusGagal(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof sso.SsoError ? error.reason : `bukan SsoError: ${String(error)}`
  }
}

let ipCounter = 0
function callbackRequest(query: Record<string, string>, flowCookie?: string) {
  const url = new URL("http://localhost:3000/api/auth/sso/callback")
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  const headers = new Headers({ "x-forwarded-for": `10.9.9.${++ipCounter}` })
  if (flowCookie) headers.set("cookie", `hns_sso_flow=${flowCookie}`)
  return new NextRequest(url, { headers })
}
function reasonOf(res: Response): string | null {
  const loc = res.headers.get("location")
  return loc ? new URL(loc).searchParams.get("reason") : null
}

const prisma = getPrisma()
const EMAIL_STAFF = "zz-test-sso-staff@contoh.test"
const EMAIL_PELANGGAN = "zz-test-sso-pelanggan@contoh.test"
const EMAIL_TAK_ADA = "zz-test-sso-tak-ada@contoh.test"

async function bersihkan() {
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL_STAFF, EMAIL_PELANGGAN, EMAIL_TAK_ADA] } } })
}

try {
  await bersihkan()

  // -------------------------------------------------------------------------
  console.log("\n1. Konfigurasi")
  cek("isSsoEnabled() true saat kelima env terisi", sso.isSsoEnabled())
  const anak = spawnSync(
    process.execPath,
    [...process.execArgv, process.argv[1]!, "--mode=env-kosong"],
    { encoding: "utf8", env: process.env },
  )
  const hasilAnak = (() => {
    try {
      return JSON.parse(anak.stdout.trim().split("\n").pop() ?? "") as { enabled: boolean; location: string | null }
    } catch {
      return null
    }
  })()
  cek("env SSO berisi string kosong → aplikasi tetap start", anak.status === 0 && hasilAnak !== null, anak.stderr.slice(0, 300))
  cek("env kosong → fitur mati", hasilAnak?.enabled === false)
  cek(
    "env kosong → /api/auth/sso/login ke halaman galat sso_not_configured",
    hasilAnak?.location?.includes("reason=sso_not_configured") === true,
    String(hasilAnak?.location),
  )

  // -------------------------------------------------------------------------
  console.log("\n2. GET /api/auth/sso/login")
  const loginRes = await loginRoute.GET()
  const authorizeUrl = new URL(loginRes.headers.get("location") ?? "http://kosong")
  const p = authorizeUrl.searchParams
  cek("redirect ke authorization_endpoint dari discovery", `${authorizeUrl.origin}${authorizeUrl.pathname}` === `${issuer}/oauth/authorize`)
  cek("client_id", p.get("client_id") === CLIENT_ID)
  cek("redirect_uri dari env (bukan dari request)", p.get("redirect_uri") === process.env.SSO_REDIRECT_URI)
  cek("response_type=code", p.get("response_type") === "code")
  cek("scope openid profile email", p.get("scope") === "openid profile email")
  cek("code_challenge_method=S256", p.get("code_challenge_method") === "S256")
  cek("code_challenge sesuai pola SSO", /^[A-Za-z0-9_-]{43,128}$/.test(p.get("code_challenge") ?? ""))
  cek("state & nonce ada", Boolean(p.get("state")) && Boolean(p.get("nonce")))

  const setCookie = loginRes.headers.get("set-cookie") ?? ""
  cek("cookie alur HttpOnly", /HttpOnly/i.test(setCookie))
  cek("cookie alur SameSite=Lax", /SameSite=lax/i.test(setCookie))
  cek("cookie alur Path=/api/auth/sso", /Path=\/api\/auth\/sso/i.test(setCookie))
  cek("cookie alur Max-Age=600", /Max-Age=600/i.test(setCookie))

  const flowRaw = setCookie.match(/hns_sso_flow=([^;]+)/)?.[1] ?? ""
  const flow = parseSsoFlow(flowRaw)
  cek("cookie alur bisa dibaca kembali", flow !== null)
  cek("state di cookie = state di URL", flow?.state === p.get("state"))
  cek("nonce di cookie = nonce di URL", flow?.nonce === p.get("nonce"))
  cek(
    "code_verifier di cookie cocok dengan code_challenge (PKCE S256)",
    createHash("sha256").update(flow?.codeVerifier ?? "").digest("base64url") === p.get("code_challenge"),
  )
  cek("code_verifier sesuai pola SSO", /^[A-Za-z0-9\-._~]{43,128}$/.test(flow?.codeVerifier ?? ""))
  const loginRes2 = await loginRoute.GET()
  cek("tiap login membuat state baru", new URL(loginRes2.headers.get("location")!).searchParams.get("state") !== p.get("state"))

  // -------------------------------------------------------------------------
  console.log("\n3. Callback menolak sebelum menyentuh SSO")
  const s = flow!.state
  cek("tanpa cookie alur → sso_state_invalid", reasonOf(await callbackRoute.GET(callbackRequest({ code: "x", state: s, iss: issuer }))) === "sso_state_invalid")
  cek("state salah → sso_state_invalid", reasonOf(await callbackRoute.GET(callbackRequest({ code: "x", state: s.slice(0, -1) + "A", iss: issuer }, flowRaw))) === "sso_state_invalid")
  cek("state beda panjang → sso_state_invalid", reasonOf(await callbackRoute.GET(callbackRequest({ code: "x", state: "pendek", iss: issuer }, flowRaw))) === "sso_state_invalid")
  cek("tanpa code → sso_state_invalid", reasonOf(await callbackRoute.GET(callbackRequest({ state: s, iss: issuer }, flowRaw))) === "sso_state_invalid")
  cek("iss tidak ada → ditolak", reasonOf(await callbackRoute.GET(callbackRequest({ code: "x", state: s }, flowRaw))) === "sso_state_invalid")
  cek("iss issuer lain → ditolak", reasonOf(await callbackRoute.GET(callbackRequest({ code: "x", state: s, iss: "https://sso-palsu.example" }, flowRaw))) === "sso_state_invalid")
  cek("error=access_denied → sso_access_denied", reasonOf(await callbackRoute.GET(callbackRequest({ error: "access_denied", state: s }, flowRaw))) === "sso_access_denied")
  cek("error lain → sso_unknown", reasonOf(await callbackRoute.GET(callbackRequest({ error: "server_error", state: s }, flowRaw))) === "sso_unknown")
  const ditolak = await callbackRoute.GET(callbackRequest({ code: "x", state: "salah", iss: issuer }, flowRaw))
  cek("cookie alur dibuang saat ditolak", /hns_sso_flow=;.*Max-Age=0/i.test(ditolak.headers.get("set-cookie") ?? ""))
  cek("halaman galat di origin SSO_REDIRECT_URI", ditolak.headers.get("location")?.startsWith("http://localhost:3000/login/error") === true)
  cek("stateMatches(null) false", !stateMatches(null, s))
  cek("parseSsoFlow cookie cacat → null", parseSsoFlow("bukan-base64-json") === null && parseSsoFlow(serializeSsoFlow({ state: "", nonce: "a", codeVerifier: "b" })) === null)

  // -------------------------------------------------------------------------
  console.log("\n4. Penukaran code & verifikasi id_token")
  const config = sso.ssoConfig()!
  function siapkanCode(code: string, f: { codeVerifier: string; nonce: string }) {
    challengeByCode.set(code, { challenge: createHash("sha256").update(f.codeVerifier).digest("base64url"), nonce: f.nonce })
  }
  idTokenClaims = { sub: "11111111-aaaa-4bbb-8ccc-000000000001", email: "  ZZ-Test-SSO-Staff@Contoh.TEST ", name: "ZZ TEST SSO" }

  const f1 = sso.createSsoFlow()
  siapkanCode("code-ok", f1)
  tokenMode = "ok"
  const identitas = await sso.exchangeSsoCode(config, "code-ok", f1)
  cek("id_token sah diterima", identitas.sub === idTokenClaims.sub)
  cek("email dinormalisasi huruf kecil tanpa spasi", identitas.email === EMAIL_STAFF)
  cek(
    "client_secret_basic: id & secret di-urlencode sebelum base64",
    lastBasicAuth === `Basic ${Buffer.from(`${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`).toString("base64")}`,
  )

  const fSalahVerifier = sso.createSsoFlow()
  siapkanCode("code-pkce", sso.createSsoFlow())
  cek("verifier PKCE milik percobaan lain → sso_token", (await harusGagal(() => sso.exchangeSsoCode(config, "code-pkce", fSalahVerifier))) === "sso_token")

  for (const [mode, nama] of [
    ["nonce-salah", "nonce salah"],
    ["aud-salah", "aud client lain"],
    ["azp-salah", "azp client lain"],
    ["kedaluwarsa", "id_token kedaluwarsa (melewati toleransi 30 dtk)"],
    ["kunci-asing", "ditandatangani kunci di luar JWKS"],
    ["tanpa-email", "tanpa klaim email"],
    ["invalid-grant", "token endpoint membalas invalid_grant"],
  ] as const) {
    const f = sso.createSsoFlow()
    siapkanCode(`code-${mode}`, f)
    tokenMode = mode
    const reason = await harusGagal(() => sso.exchangeSsoCode(config, `code-${mode}`, f))
    cek(`${nama} → ditolak (sso_token)`, reason === "sso_token", String(reason))
  }
  tokenMode = "ok"

  const configSecretSalah = { ...config, clientSecret: "salah" }
  const fSecret = sso.createSsoFlow()
  siapkanCode("code-secret", fSecret)
  cek("client secret salah → sso_token", (await harusGagal(() => sso.exchangeSsoCode(configSecretSalah, "code-secret", fSecret))) === "sso_token")

  const configTakTerjangkau = { ...config, issuer: "http://127.0.0.1:1" }
  cek("SSO tak terjangkau → sso_network", (await harusGagal(() => sso.buildSsoAuthorizationUrl(configTakTerjangkau, sso.createSsoFlow()))) === "sso_network")

  // -------------------------------------------------------------------------
  console.log("\n5. Pencocokan akun (DB lokal, akun ZZ TEST)")
  const sebelum = await prisma.user.count()
  const takAda = await resolveStaffForSso({ sub: "22222222-0000-4000-8000-000000000002", email: EMAIL_TAK_ADA, name: "x" })
  cek("email tak terdaftar → sso_not_provisioned", !takAda.ok && takAda.reason === "sso_not_provisioned")
  cek("tidak ada akun yang dibuat otomatis", (await prisma.user.count()) === sebelum)

  await prisma.user.create({
    data: { email: EMAIL_PELANGGAN, name: "ZZ TEST SSO Pelanggan", role: "pelanggan" },
  })
  const pelanggan = await resolveStaffForSso({ sub: "33333333-0000-4000-8000-000000000003", email: EMAIL_PELANGGAN, name: "x" })
  cek("email milik akun pelanggan → sso_customer_account", !pelanggan.ok && pelanggan.reason === "sso_customer_account")
  const barisPelanggan = await prisma.user.findUnique({ where: { email: EMAIL_PELANGGAN }, select: { ssoSub: true, role: true } })
  cek("akun pelanggan TIDAK ditautkan & perannya tidak berubah", barisPelanggan?.ssoSub === null && barisPelanggan.role === "pelanggan")

  const staff = await prisma.user.create({
    data: { email: EMAIL_STAFF, name: "ZZ TEST SSO Staff", username: "zz-test-sso-staff", role: "staff" },
  })
  const pertama = await resolveStaffForSso(identitas)
  cek("staff disiapkan owner → tertaut lewat email", pertama.ok && pertama.user.id === staff.id && pertama.linkedNow)
  cek("sso_sub tersimpan", (await prisma.user.findUnique({ where: { id: staff.id } }))?.ssoSub === identitas.sub)

  const kedua = await resolveStaffForSso(identitas)
  cek("login berikutnya ketemu lewat sso_sub (bukan tautan baru)", kedua.ok && kedua.user.id === staff.id && !kedua.linkedNow)

  // Kontrol positif callback: semua syarat dipenuhi. Di luar server Next,
  // `cookies()` di `createSession` melempar "outside a request scope" —
  // galat itu BUKTI callback lolos seluruh pemeriksaan dan sampai ke langkah
  // membuat sesi. Tanpa uji ini, bagian 3 tetap lolos andai callback menolak
  // segalanya.
  const loginPositif = await loginRoute.GET()
  const flowPositifRaw = (loginPositif.headers.get("set-cookie") ?? "").match(/hns_sso_flow=([^;]+)/)?.[1] ?? ""
  const flowPositif = parseSsoFlow(flowPositifRaw)!
  siapkanCode("code-callback-ok", flowPositif)
  let galatCallback = ""
  try {
    const res = await callbackRoute.GET(
      callbackRequest({ code: "code-callback-ok", state: flowPositif.state, iss: issuer }, flowPositifRaw),
    )
    galatCallback = `tidak melempar; reason=${reasonOf(res)}`
  } catch (error) {
    galatCallback = String(error)
  }
  cek(
    "callback sah lolos semua pemeriksaan sampai createSession",
    /request scope|cookies/i.test(galatCallback),
    galatCallback.slice(0, 200),
  )

  await prisma.user.update({ where: { id: staff.id }, data: { email: "zz-test-sso-staff-ganti@contoh.test" } })
  const emailBerubah = await resolveStaffForSso({ ...identitas, email: "alamat-baru-di-sso@contoh.test" })
  cek("email berubah di SSO → tetap akun yang sama (lewat sub)", emailBerubah.ok && emailBerubah.user.id === staff.id)
  await prisma.user.update({ where: { id: staff.id }, data: { email: EMAIL_STAFF } })

  const orangLain = await resolveStaffForSso({ sub: "44444444-0000-4000-8000-000000000004", email: EMAIL_STAFF, name: "Sales baru" })
  cek("alamat email berpindah ke orang SSO lain → sso_sub_conflict", !orangLain.ok && orangLain.reason === "sso_sub_conflict")
  cek("akun lama tetap milik sub lama", (await prisma.user.findUnique({ where: { id: staff.id } }))?.ssoSub === identitas.sub)

  await prisma.user.update({ where: { id: staff.id }, data: { role: "pelanggan" } })
  const diturunkan = await resolveStaffForSso(identitas)
  cek("staff tertaut yang diturunkan jadi pelanggan → ditolak", !diturunkan.ok && diturunkan.reason === "sso_customer_account")

  // -------------------------------------------------------------------------
  console.log("\n6. Sesi 12 jam")
  const token = await signSession({ sub: staff.id, email: EMAIL_STAFF }, sso.SSO_SESSION_MAX_AGE_SECONDS)
  const payload = await verifySession(token)
  cek("token sesi SSO berumur 12 jam", payload !== null && payload.exp - payload.iat === 12 * 60 * 60)
  cek("cookie sesi SSO Max-Age 12 jam", sessionCookieOptions(sso.SSO_SESSION_MAX_AGE_SECONDS).maxAge === 43200)
  const tokenBiasa = await verifySession(await signSession({ sub: staff.id, email: EMAIL_STAFF }))
  cek("sesi password tetap 7 hari", tokenBiasa !== null && tokenBiasa.exp - tokenBiasa.iat === 7 * 24 * 60 * 60)
} finally {
  await bersihkan()
  const sisa = await prisma.user.count({ where: { email: { startsWith: "zz-test-sso" } } })
  console.log(`\nBersih-bersih: ${sisa === 0 ? "akun ZZ TEST terhapus" : `MASIH ADA ${sisa} akun ZZ TEST`}`)
  server.close()
  await prisma.$disconnect().catch(() => {})
}

console.log(`\n${lolos} lolos, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log(`  - ${g}`)
  process.exit(1)
}
process.exit(0)
