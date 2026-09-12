import { NextResponse, type NextRequest } from "next/server"
import { getPrisma } from "@/lib/prisma/client"
import { exchangeCodeForIdentity } from "@/lib/auth/google"
import { createCustomerSession } from "@/lib/auth/customer"
import { createSession } from "@/lib/auth"
import { findUserByGoogleIdentity } from "@/lib/auth/identity"
import { isMaster } from "@/lib/auth/permissions"
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

  const prisma = getPrisma()
  const email = identity.email.trim().toLowerCase()

  /**
   * Akun dicari di `users`, bukan `customers`.
   *
   * Sejak Satu Login semua akun hidup di sana, dan hanya di sana ada `role` —
   * yang menentukan orang ini berakhir di storefront atau di panel admin. Dulu
   * callback ini menulis langsung ke `customers` dan selalu membuat sesi
   * pelanggan, sehingga akun admin yang masuk lewat Google akan dibuatkan baris
   * pelanggan baru alih-alih dikenali sebagai dirinya sendiri.
   */
  const account = await findUserByGoogleIdentity(identity.googleSub, email)

  let userId: string
  let role: string
  let username: string | null
  let phoneNumber: string | null

  if (!account) {
    /**
     * Pendaftar Google baru. Barisnya ditulis ke `users` DAN `customers`
     * dengan id yang sama.
     *
     * Dua tabel karena Satu Login baru merampungkan separuh: `users` sudah jadi
     * sumber kebenaran identitas, tapi sesi pelanggan masih dibaca dari
     * `customers` (`getCurrentCustomer`). Selama itu belum disatukan (Fase B),
     * pendaftar yang cuma masuk ke salah satunya akan pincang — ada di satu
     * tabel, hilang di tabel lain.
     *
     * `emailVerifiedAt` langsung diisi: Google sudah membuktikan kepemilikan
     * email itu, tidak ada verifikasi kedua yang masuk akal.
     */
    const now = new Date()
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          googleSub: identity.googleSub,
          email,
          name: identity.name,
          role: "pelanggan",
          emailVerifiedAt: now,
        },
        select: { id: true, role: true, username: true, phoneNumber: true },
      })
      await tx.customer.create({
        data: {
          id: user.id,
          googleSub: identity.googleSub,
          email,
          name: identity.name,
          emailVerifiedAt: now,
        },
      })
      return user
    })
    userId = created.id
    role = created.role
    username = created.username
    phoneNumber = created.phoneNumber
  } else {
    /**
     * Akun sudah ada. Kalau `googleSub`-nya belum terisi, ini orang yang
     * akunnya lahir lewat password lalu kini menekan "Masuk dengan Google" —
     * sub-nya ditautkan supaya kedua jalur menuju akun yang sama.
     *
     * Sebelumnya kasus ini DITOLAK, mengikuti aturan lama di schema.prisma
     * ("satu email = satu jalur identitas, tidak digabung"). Aturan itu diubah
     * atas permintaan pemilik project 7 Sep 2026: orang yang sama dengan email
     * yang sama tertahan di depan pintu tanpa alasan yang bisa ia mengerti.
     *
     * Penautan ini AMAN karena `exchangeCodeForIdentity` menolak id_token yang
     * `email_verified != true`: Google sudah membuktikan orang ini memegang
     * email tersebut. Ia juga tidak membuka jalan baru — siapa pun yang
     * menguasai email itu sudah bisa mengambil alih akunnya lewat "Lupa
     * password", yang mengirim tautan ke alamat yang sama.
     *
     * Nama sengaja TIDAK ikut disegarkan di sini. Untuk akun yang sudah ada,
     * namanya bisa saja sudah dirapikan staff atau pemiliknya sendiri, dan
     * menimpanya tiap kali orang masuk lewat Google membuat suntingan itu
     * hilang tanpa ada yang merasa mengubahnya.
     */
    if (!account.googleSub) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: account.id },
          data: { googleSub: identity.googleSub },
        })
        // Baris `customers` tidak selalu ada — akun admin murni hanya hidup di
        // `users` (mis. akun owner yang dibuat lewat skrip, bukan lewat
        // pendaftaran). `updateMany` tidak melempar saat tak ada yang cocok.
        await tx.customer.updateMany({
          where: { id: account.id },
          data: { googleSub: identity.googleSub },
        })
      })
    }
    userId = account.id
    role = account.role
    username = account.username
    phoneNumber = account.phoneNumber
  }

  /**
   * Tujuan ditentukan PERAN, bukan cara masuknya — pola yang sama persis dengan
   * `loginAction` di /login. Inti Satu Login: satu pintu, sistem yang membaca
   * siapa yang masuk.
   *
   * MASTER dikecualikan dengan alasan yang sama seperti di sana: `isMaster`
   * hanya dibaca setelah sesi admin ada, jadi alamat master yang berperan
   * "pelanggan" tidak akan pernah sampai ke panel yang dijaganya. Justru jalur
   * Google-lah yang paling mungkin dipakai master, karena alamat developer
   * biasanya akun Google tanpa password.
   */
  if (role !== "pelanggan" || isMaster({ email })) {
    await createSession({ id: userId, email })
    const adminResponse = NextResponse.redirect(new URL("/admin", origin))
    adminResponse.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 })
    return adminResponse
  }

  await createCustomerSession({ id: userId, email })

  // Google tidak pernah memberi username atau nomor HP — akun yang belum
  // melengkapi keduanya WAJIB mampir ke /profile/lengkapi-profil dulu sebelum
  // ke tujuan aslinya (lihat catatan di schema.prisma pada Customer.username).
  // `next` dibawa serta supaya redirect asli tidak hilang setelah dilengkapi.
  const redirectTarget =
    !username || !phoneNumber
      ? `/profile/lengkapi-profil?next=${encodeURIComponent(nextPath)}`
      : nextPath

  const response = NextResponse.redirect(new URL(redirectTarget, origin))
  // Cookie state sekali pakai — buang setelah dipakai, sukses maupun gagal.
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}
