import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/config/env"
import { createSession } from "@/lib/auth"
import { checkGoogleCallbackRateLimit, clientIpFrom } from "@/lib/auth/google-callback-rate-limit"
import { landingPathFor, muatIzinUser } from "@/lib/auth/permissions"
import { exchangeSsoCode, ssoConfig, SsoError, SSO_SESSION_MAX_AGE_SECONDS } from "@/lib/auth/sso"
import { resolveStaffForSso } from "@/lib/auth/sso-link"
import { parseSsoFlow, SSO_FLOW_COOKIE, ssoFlowCookieOptions, stateMatches } from "@/lib/auth/sso-state"

export const dynamic = "force-dynamic"

/**
 * Callback HNS SSO — docs/19-sso-staff.md §2.
 *
 * Urutan pemeriksaannya mengikuti panduan SSO dan tidak boleh ditukar:
 *   `error` → `state` (konstan-waktu, terhadap cookie) → `iss` (RFC 9207)
 *   → tukar code dengan PKCE verifier → verifikasi id_token (di
 *   `exchangeSsoCode`) → cocokkan akun → sesi admin 12 jam.
 *
 * Setiap kegagalan bermuara ke `/login/error?reason=sso_…` dengan pesan yang
 * bisa ditindaklanjuti staff; detail teknisnya hanya di log server. Cookie
 * alur dibuang di SETIAP jawaban — ia sekali pakai, sukses maupun gagal.
 */
export async function GET(request: NextRequest) {
  const config = ssoConfig()
  // Dari env, bukan `request.url` — lihat catatan di rute login.
  const base = config ? new URL(config.redirectUri).origin : env.NEXT_PUBLIC_SITE_URL

  const finish = (response: NextResponse) => {
    response.cookies.set(SSO_FLOW_COOKIE, "", ssoFlowCookieOptions(0))
    return response
  }
  const errorPage = (reason: string) => {
    const url = new URL("/login/error", base)
    url.searchParams.set("reason", reason)
    return finish(NextResponse.redirect(url))
  }

  if (!config) return errorPage("sso_not_configured")

  // Pembatas yang sama dengan callback Google, dengan kunci terpisah supaya
  // kedua jalur tidak saling menghabiskan jatah. Penjaga terhadap callback yang
  // direfresh berulang atau dicoba manual — bukan pertahanan utama.
  if (!checkGoogleCallbackRateLimit(`sso:${clientIpFrom(request.headers)}`).ok) {
    return errorPage("rate_limit")
  }

  const params = request.nextUrl.searchParams

  const ssoErrorCode = params.get("error")
  if (ssoErrorCode) {
    if (ssoErrorCode === "access_denied") return errorPage("sso_access_denied")
    console.error("[sso/callback] SSO mengembalikan galat:", ssoErrorCode, params.get("error_description"))
    return errorPage("sso_unknown")
  }

  const flow = parseSsoFlow(request.cookies.get(SSO_FLOW_COOKIE)?.value)
  const code = params.get("code")
  if (!flow || !code || !stateMatches(params.get("state"), flow.state)) {
    return errorPage("sso_state_invalid")
  }

  // RFC 9207: SSO HNS SELALU mengirim `iss`. Yang tidak ada atau berbeda
  // berarti callback ini bukan dari issuer kita (serangan mix-up).
  if (params.get("iss") !== config.issuer) {
    console.error("[sso/callback] iss tidak cocok:", params.get("iss"))
    return errorPage("sso_state_invalid")
  }

  let identity: Awaited<ReturnType<typeof exchangeSsoCode>>
  try {
    identity = await exchangeSsoCode(config, code, flow)
  } catch (error) {
    console.error("[sso/callback] penukaran/verifikasi gagal:", error)
    return errorPage(error instanceof SsoError ? error.reason : "sso_unknown")
  }

  const linked = await resolveStaffForSso(identity)
  if (!linked.ok) {
    // Email ditulis ke log supaya owner bisa menelusuri kenapa seseorang
    // tertahan — ini log server, bukan layar, dan email staff bukan rahasia
    // di dalam panel yang sama.
    console.warn(`[sso/callback] ${linked.reason} untuk ${identity.email}`)
    return errorPage(linked.reason)
  }
  if (linked.linkedNow) console.info(`[sso/callback] akun ${linked.user.id} ditautkan ke SSO`)

  await createSession({ id: linked.user.id, email: linked.user.email }, SSO_SESSION_MAX_AGE_SECONDS)

  // Tujuan ditentukan izin — sama persis dengan `loginAction` di /login.
  const landing = landingPathFor(await muatIzinUser(linked.user))
  return finish(NextResponse.redirect(new URL(landing, base)))
}
