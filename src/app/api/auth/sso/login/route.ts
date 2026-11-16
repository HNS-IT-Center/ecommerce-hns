import { NextResponse, type NextRequest } from "next/server"
import { env } from "@/config/env"
import { buildSsoAuthorizationUrl, createSsoFlow, normalizeLoginHint, ssoConfig, SsoError } from "@/lib/auth/sso"
import { serializeSsoFlow, SSO_FLOW_COOKIE, ssoFlowCookieOptions } from "@/lib/auth/sso-state"

export const dynamic = "force-dynamic"

/**
 * Mulai login SSO — docs/19-sso-staff.md.
 *
 * Tidak ada tombol yang menunjuk ke sini dari halaman login (keputusan 16 Nov
 * 2026: pintu staff tidak diumumkan). Yang memanggilnya:
 *   - callback Google, untuk email yang dijawab SSO sebagai staff ber-akses —
 *     dengan `?login_hint=<email>` supaya kolom email di SSO sudah terisi;
 *   - Portal SSO, karena URL ini adalah "Initiate Login URL" client;
 *   - tombol "Coba lagi" di halaman galat SSO.
 *
 * Membuat `state`, `nonce`, dan PKCE verifier baru, menyimpannya di cookie
 * sementara, lalu mengarahkan ke halaman login SSO.
 *
 * Alamat halaman galat dibentuk dari env, BUKAN dari `request.url`: di balik
 * proxy Hostinger alamat request terbaca sebagai alamat bind server.
 */
export async function GET(request: NextRequest) {
  const config = ssoConfig()
  const base = config ? new URL(config.redirectUri).origin : env.NEXT_PUBLIC_SITE_URL

  const errorPage = (reason: string) => {
    const url = new URL("/login/error", base)
    url.searchParams.set("reason", reason)
    return NextResponse.redirect(url)
  }

  if (!config) return errorPage("sso_not_configured")

  const flow = createSsoFlow()
  const loginHint = normalizeLoginHint(request.nextUrl.searchParams.get("login_hint"))
  let authorizationUrl: string
  try {
    authorizationUrl = await buildSsoAuthorizationUrl(config, flow, { loginHint })
  } catch (error) {
    console.error("[sso/login] gagal menyiapkan login SSO:", error)
    return errorPage(error instanceof SsoError ? error.reason : "sso_network")
  }

  const response = NextResponse.redirect(authorizationUrl)
  response.cookies.set(SSO_FLOW_COOKIE, serializeSsoFlow(flow), ssoFlowCookieOptions())
  return response
}
