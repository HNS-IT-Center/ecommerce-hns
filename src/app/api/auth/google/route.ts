import { NextResponse, type NextRequest } from "next/server"
import { buildGoogleAuthUrl } from "@/lib/auth/google"
import { buildState, GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE_SECONDS } from "@/lib/auth/google-state"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"

/**
 * Titik masuk tombol "Masuk dengan Google". Membangun `state` (nonce CSRF +
 * tujuan setelah login), menyimpan nonce-nya di cookie sementara, lalu
 * redirect ke layar consent Google.
 */
export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"))
  const { state, nonce } = buildState(nextPath)

  const response = NextResponse.redirect(buildGoogleAuthUrl(request.nextUrl.origin, state))
  response.cookies.set(GOOGLE_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  })
  return response
}
