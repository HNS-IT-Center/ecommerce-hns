import { NextResponse, type NextRequest } from "next/server"
import { getPrisma } from "@/lib/prisma/client"
import { exchangeCodeForIdentity } from "@/lib/auth/google"
import { createCustomerSession } from "@/lib/auth/customer"
import { GOOGLE_STATE_COOKIE, parseState } from "@/lib/auth/google-state"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"
import { checkGoogleCallbackRateLimit, clientIpFrom } from "@/lib/auth/google-callback-rate-limit"

/**
 * Callback OAuth Google. Endpoint PUBLIK yang MENULIS ke database — lihat
 * docs/09 §9.2 (rate limit) dan §9.1 (semua kegagalan bermuara ke satu
 * halaman error yang menjelaskan, bukan redirect diam-diam atau halaman
 * kosong).
 */
export async function GET(request: NextRequest) {
  const errorPage = (reason: string) => {
    const url = new URL("/login/error", request.nextUrl.origin)
    url.searchParams.set("reason", reason)
    return NextResponse.redirect(url)
  }

  const rateLimit = checkGoogleCallbackRateLimit(clientIpFrom(request.headers))
  if (!rateLimit.ok) {
    return errorPage("rate_limit")
  }

  const params = request.nextUrl.searchParams

  // Pelanggan membatalkan izin di layar consent Google — bukan galat.
  if (params.get("error") === "access_denied") {
    return errorPage("access_denied")
  }
  if (params.has("error")) {
    // Detail teknis (`error_description`) masuk log server saja, bukan ke
    // layar pelanggan — docs/09 §9.1.
    console.error("Google OAuth callback error:", params.get("error"), params.get("error_description"))
    return errorPage("unknown")
  }

  const code = params.get("code")
  const expectedNonce = request.cookies.get(GOOGLE_STATE_COOKIE)?.value
  const parsedState = parseState(params.get("state"), expectedNonce)

  if (!code || !parsedState) {
    return errorPage("state_invalid")
  }

  const nextPath = sanitizeNextPath(parsedState.nextPath)

  let identity: Awaited<ReturnType<typeof exchangeCodeForIdentity>>
  try {
    identity = await exchangeCodeForIdentity(code, request.nextUrl.origin)
  } catch (error) {
    console.error("Gagal menukar/verifikasi id_token Google:", error)
    return errorPage("network")
  }

  const customer = await getPrisma().customer.upsert({
    where: { googleSub: identity.googleSub },
    create: { googleSub: identity.googleSub, email: identity.email, name: identity.name },
    // Email/nama Google bisa berubah antar login — selalu disegarkan supaya
    // tidak menyimpan data yang sudah usang.
    update: { email: identity.email, name: identity.name },
    select: { id: true, email: true },
  })

  await createCustomerSession(customer)

  const response = NextResponse.redirect(new URL(nextPath, request.nextUrl.origin))
  // Cookie state sekali pakai — buang setelah dipakai, sukses maupun gagal.
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
