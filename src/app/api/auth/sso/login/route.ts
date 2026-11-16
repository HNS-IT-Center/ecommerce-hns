import { NextResponse } from "next/server"
import { env } from "@/config/env"
import { buildSsoAuthorizationUrl, createSsoFlow, ssoConfig, SsoError } from "@/lib/auth/sso"
import { serializeSsoFlow, SSO_FLOW_COOKIE, ssoFlowCookieOptions } from "@/lib/auth/sso-state"

export const dynamic = "force-dynamic"

/**
 * Titik masuk "Masuk dengan SSO HNS" — sekaligus "Initiate Login URL" yang
 * didaftarkan di SSO (dibuka dari Portal SSO). docs/19-sso-staff.md.
 *
 * Membuat `state`, `nonce`, dan PKCE verifier baru, menyimpannya di cookie
 * sementara, lalu mengarahkan ke halaman login SSO.
 *
 * Alamat halaman galat dibentuk dari env, BUKAN dari `request.url`: di balik
 * proxy Hostinger alamat request terbaca sebagai alamat bind server.
 */
export async function GET() {
  const config = ssoConfig()
  const base = config ? new URL(config.redirectUri).origin : env.NEXT_PUBLIC_SITE_URL

  const errorPage = (reason: string) => {
    const url = new URL("/login/error", base)
    url.searchParams.set("reason", reason)
    return NextResponse.redirect(url)
  }

  if (!config) return errorPage("sso_not_configured")

  const flow = createSsoFlow()
  let authorizationUrl: string
  try {
    authorizationUrl = await buildSsoAuthorizationUrl(config, flow)
  } catch (error) {
    console.error("[sso/login] gagal menyiapkan login SSO:", error)
    return errorPage(error instanceof SsoError ? error.reason : "sso_network")
  }

  const response = NextResponse.redirect(authorizationUrl)
  response.cookies.set(SSO_FLOW_COOKIE, serializeSsoFlow(flow), ssoFlowCookieOptions())
  return response
}
