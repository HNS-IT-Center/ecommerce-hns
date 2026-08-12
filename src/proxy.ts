import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session"
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession } from "@/lib/auth/customer-session"

/**
 * Penjaga pertama untuk /admin dan /akun — dua sesi yang TIDAK BOLEH saling
 * menyentuh (lihat docs/09-google-oauth-setup.md §1). Ditulis dalam satu
 * fungsi karena Next hanya memuat satu file proxy per project, bukan tanda
 * keduanya berbagi logika.
 *
 * Berkas ini bernama `proxy.ts`, bukan `middleware.ts`. Next 16 menandai
 * konvensi `middleware` sebagai deprecated dan mengarahkan ke `proxy`;
 * perilakunya sama, hanya namanya yang berganti. Ditulis dengan nama baru sejak
 * awal supaya tidak perlu dipindahkan lagi nanti.
 *
 * Sengaja mengimpor dari `lib/auth/session` dan `lib/auth/customer-session` —
 * BUKAN dari `lib/auth` atau `lib/auth/customer` — karena berkas indeks itu
 * menarik `next/headers` dan Prisma, dan keduanya tidak tersedia di Edge
 * runtime tempat middleware berjalan. Kedua modul sesi memakai Web Crypto
 * justru supaya bisa dipakai di kedua tempat tanpa dua implementasi.
 *
 * Yang diperiksa di sini hanya tanda tangan dan masa berlaku cookie. Apakah
 * akunnya masih ada tidak bisa ditanyakan dari sini — itu urusan layout/halaman,
 * yang membaca ulang tabel User/Customer. Middleware adalah gerbang, bukan
 * otoritas: ia menyaring permintaan tanpa sesi sebelum menyentuh server, dan
 * sisanya diputuskan lebih dalam.
 *
 * Proteksi ini TIDAK menggantikan pemeriksaan di server action dan route
 * handler. Keduanya bisa dipanggil langsung lewat POST tanpa pernah melewati
 * navigasi halaman, jadi masing-masing tetap memanggil `requireAuth()`/
 * `getCurrentCustomer()` sendiri.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith("/admin")) {
    // Halaman masuk harus tetap terbuka, kalau tidak tidak ada yang bisa masuk.
    if (pathname === "/admin/login") return NextResponse.next()

    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
    if (session) return NextResponse.next()

    const login = new URL("/admin/login", request.url)
    // Bawa tujuan semula supaya setelah masuk, PIC kembali ke halaman yang tadi
    // dituju — bukan dilempar ke dashboard dan harus mencari jalannya lagi.
    login.searchParams.set("callbackUrl", `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  // /akun/:path*
  const session = await verifyCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  const login = new URL("/login", request.url)
  login.searchParams.set("next", `${pathname}${search}`)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ["/admin/:path*", "/akun/:path*"],
}
