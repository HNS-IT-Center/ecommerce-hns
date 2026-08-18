import { NextResponse, type NextRequest } from "next/server"
import { buildGoogleAuthUrl } from "@/lib/auth/google"
import { buildState, GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE_SECONDS } from "@/lib/auth/google-state"
import { sanitizeNextPath } from "@/lib/auth/safe-redirect"
import { resolveSiteUrl } from "@/lib/utils/site-url"

/**
 * Titik masuk tombol "Masuk dengan Google". Membangun `state` (nonce CSRF +
 * tujuan setelah login), menyimpan nonce-nya di cookie sementara, lalu
 * redirect ke layar consent Google.
 */
export async function GET(request: NextRequest) {
  const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"))
  const { state, nonce } = buildState(nextPath)

  // `resolveSiteUrl()`, BUKAN `request.nextUrl.origin`.
  //
  // Di balik proxy Hostinger (`Server: hcdn`), `nextUrl.origin` menghasilkan
  // ALAMAT BIND server, bukan domain publik. Diukur 18 Agustus 2026 dengan
  // `curl -I https://store.hnsitcenter.id/api/auth/google`, header `location`
  // memuat:
  //
  //     redirect_uri=https%3A%2F%2F0.0.0.0%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback
  //
  // Google MENOLAK `0.0.0.0` sebagai redirect URI — itu alamat bind, bukan
  // domain — dan menolaknya sebagai PELANGGARAN KEBIJAKAN: "Access blocked:
  // doesn't comply with Google's OAuth 2.0 policy" (`Error 400:
  // invalid_request`), BUKAN `redirect_uri_mismatch`. Perbedaan pesan itu
  // menyesatkan: URI di Google Console sudah benar, yang salah URI yang
  // dikirim. Gejalanya juga tidak bergantung akun — siapa pun yang login
  // mendapat error identik, karena yang ditolak bentuk permintaannya.
  //
  // Skemanya sendiri `https` — jadi ini BUKAN soal `x-forwarded-proto`.
  //
  // `isTrustedHost("0.0.0.0")` bernilai false, sehingga `resolveSiteUrl()`
  // menolak alamat bind itu dan jatuh ke `NEXT_PUBLIC_SITE_URL`. Artinya env
  // tersebut WAJIB benar di setiap lingkungan — ia jaring pengaman terakhir,
  // bukan sekadar pelengkap.
  //
  // `resolveSiteUrl()` membaca `x-forwarded-proto`/`x-forwarded-host` dan
  // menyaringnya lewat daftar host tepercaya. Pelajaran yang sama sudah
  // diterapkan di `lib/utils/indexable-host.ts`; rute ini tertinggal.
  //
  // WAJIB sama persis dengan yang dipakai callback saat menukar kode —
  // Google mencocokkan `redirect_uri` di kedua langkah.
  const origin = await resolveSiteUrl()

  const response = NextResponse.redirect(buildGoogleAuthUrl(origin, state))
  response.cookies.set(GOOGLE_STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_STATE_MAX_AGE_SECONDS,
  })
  return response
}
