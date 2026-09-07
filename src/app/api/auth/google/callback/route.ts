import { NextResponse, type NextRequest } from "next/server"
import { getPrisma } from "@/lib/prisma/client"
import { exchangeCodeForIdentity } from "@/lib/auth/google"
import { createCustomerSession } from "@/lib/auth/customer"
import { GOOGLE_STATE_COOKIE, parseState } from "@/lib/auth/google-state"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"
import { checkGoogleCallbackRateLimit, clientIpFrom } from "@/lib/auth/google-callback-rate-limit"
import { resolveSiteUrl } from "@/lib/utils/site-url"

/**
 * Callback OAuth Google. Endpoint PUBLIK yang MENULIS ke database — lihat
 * docs/09 §9.2 (rate limit) dan §9.1 (semua kegagalan bermuara ke satu
 * halaman error yang menjelaskan, bukan redirect diam-diam atau halaman
 * kosong).
 */
export async function GET(request: NextRequest) {
  // Harus sama persis dengan origin yang dipakai `/api/auth/google` saat
  // membangun `redirect_uri` — Google mencocokkan keduanya. Lihat alasan
  // lengkapnya (CDN Hostinger, http vs https) di rute tersebut.
  const origin = await resolveSiteUrl()

  const errorPage = (reason: string) => {
    const url = new URL("/login/error", origin)
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
    identity = await exchangeCodeForIdentity(code, origin)
  } catch (error) {
    console.error("Gagal menukar/verifikasi id_token Google:", error)
    return errorPage("network")
  }

  // Dulu ini `customer.upsert({ where: { googleSub } })`. Itu CRASH 500 mentah
  // (P2002) saat `googleSub` tak ketemu TAPI email-nya sudah dipakai baris lain
  // — sebab upsert lalu mencoba CREATE dan menabrak `email @unique`. Kasus itu
  // nyata: akun daftar-manual (password) memakai email yang sama dengan yang
  // dipakai orang menekan "Masuk dengan Google". Aturan project (schema.prisma
  // pada Customer.googleSub): satu email = SATU jalur identitas, Google ATAU
  // password, TIDAK digabung otomatis. Jadi tiga cabang eksplisit di bawah,
  // bukan satu upsert yang menyembunyikan bentrokan.
  const prisma = getPrisma()
  const byGoogle = await prisma.customer.findUnique({
    where: { googleSub: identity.googleSub },
    select: { id: true },
  })

  let customer: { id: string; email: string; username: string | null; phoneNumber: string | null }

  if (byGoogle) {
    // Pelanggan Google yang sudah pernah masuk — segarkan email/nama (bisa
    // berubah di sisi Google) lalu pakai barisnya.
    customer = await prisma.customer.update({
      where: { id: byGoogle.id },
      data: { email: identity.email, name: identity.name },
      select: { id: true, email: true, username: true, phoneNumber: true },
    })
  } else {
    const byEmail = await prisma.customer.findUnique({
      where: { email: identity.email },
      select: { id: true, passwordHash: true, googleSub: true },
    })

    if (byEmail?.passwordHash) {
      // Email ini milik akun PASSWORD. Jangan gabungkan diam-diam (bisa jadi
      // jalur pembajakan: siapa pun yang menguasai email Google berjudul sama
      // akan menempel ke akun password orang). Tolak dengan rapi — bukan 500.
      return errorPage("email_terpakai_password")
    }

    if (byEmail) {
      // Baris email ada tapi TANPA password (akun Google yang `googleSub`-nya
      // belum terisi) — tautkan sub-nya, aman karena tak ada kredensial lain.
      customer = await prisma.customer.update({
        where: { id: byEmail.id },
        data: { googleSub: identity.googleSub, email: identity.email, name: identity.name },
        select: { id: true, email: true, username: true, phoneNumber: true },
      })
    } else {
      // Pelanggan Google betul-betul baru.
      customer = await prisma.customer.create({
        data: { googleSub: identity.googleSub, email: identity.email, name: identity.name },
        select: { id: true, email: true, username: true, phoneNumber: true },
      })
    }
  }

  await createCustomerSession(customer)

  // Google tidak pernah memberi username atau nomor HP — akun yang belum
  // melengkapi keduanya WAJIB mampir ke /profile/lengkapi-profil dulu sebelum
  // ke tujuan aslinya (lihat catatan di schema.prisma pada Customer.username).
  // `next` dibawa serta supaya redirect asli tidak hilang setelah dilengkapi.
  const redirectTarget =
    !customer.username || !customer.phoneNumber
      ? `/profile/lengkapi-profil?next=${encodeURIComponent(nextPath)}`
      : nextPath

  const response = NextResponse.redirect(new URL(redirectTarget, origin))
  // Cookie state sekali pakai — buang setelah dipakai, sukses maupun gagal.
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
