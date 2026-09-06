import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session"
import { CUSTOMER_SESSION_COOKIE, verifyCustomerSession } from "@/lib/auth/customer-session"

/**
 * Origin publik permintaan, dari header proxy — BUKAN `request.url`.
 *
 * Di balik proxy Hostinger `request.url` berisi alamat bind server Next
 * (`0.0.0.0:3000`), bukan alamat publik, jadi `new URL(path, request.url)`
 * melempar orang ke host yang tidak bisa dibuka. Itu bug yang sama yang
 * membuat QR produk mendarat di `https://0.0.0.0:3000/product/...`; di sini
 * gejalanya lebih jarang terlihat karena hanya muncul saat sesi habis.
 *
 * Berbeda dari `src/app/p/[id]/route.ts`, di sini `Location` relatif BUKAN
 * pilihan: lapisan proxy Next mem-parse header ini sendiri dan menolak URL
 * relatif dengan `TypeError: Invalid URL` (500). Jadi origin harus disusun,
 * dan satu-satunya sumber yang benar adalah header terusan dari proxy.
 *
 * Ini menirukan `resolveSiteUrl()` di `lib/utils/site-url.ts`, yang tidak bisa
 * diimpor ke sini: modul itu `server-only` dan memakai `next/headers`,
 * sedangkan berkas ini berjalan di Edge runtime.
 */
function requestOrigin(request: NextRequest): string {
  const headers = request.headers
  // `x-forwarded-host` didahulukan: di balik proxy, `host` berisi host internal.
  // Bisa berupa daftar ("a.com, b.com") kalau melewati beberapa proxy.
  const rawHost =
    headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    headers.get("host")?.split(",")[0].trim()

  // Tanpa host sama sekali, `request.nextUrl.origin` adalah satu-satunya yang
  // tersisa. Itu bisa saja alamat bind — tapi permintaan tanpa header `Host`
  // tidak datang dari browser sungguhan, dan menebak di sini lebih baik
  // daripada melempar 500 ke jalur masuk.
  if (!rawHost) return request.nextUrl.origin

  const hostname = rawHost.replace(/:\d+$/, "")
  const proto =
    headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (hostname === "localhost" || hostname === "127.0.0.1" ? "http" : "https")

  return `${proto}://${rawHost}`
}

/**
 * Redirect ke halaman masuk, dibangun di atas origin publik permintaan.
 *
 * Host TIDAK divalidasi lewat daftar izin di sini, berbeda dari
 * `resolveSiteUrl()`. Tujuannya selalu path di origin yang sama, jadi header
 * `Host` palsu hanya memantulkan penyerang ke situsnya sendiri — tidak ada
 * korban lain dan tidak ada data yang bocor. Yang berbahaya adalah host palsu
 * yang ikut ke dalam email atau QR resmi; itu dijaga di tempatnya
 * masing-masing (`resolvePublicUrl()` dan `resolveSiteUrl()`).
 */
function redirectToLogin(
  request: NextRequest,
  loginPath: string,
  paramName: string,
  target: string
): NextResponse {
  // `URLSearchParams` meng-encode nilainya, jadi tujuan yang mengandung `&`
  // atau `#` tidak bisa menyelundupkan parameter tambahan ke tautan masuk.
  const query = new URLSearchParams({ [paramName]: target })
  return NextResponse.redirect(`${requestOrigin(request)}${loginPath}?${query}`, 307)
}

/**
 * Penjaga pertama untuk /admin dan /profile — dua sesi yang TIDAK BOLEH saling
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
    // `/admin/login` dibiarkan lewat: sejak Satu Login (Fase A) ia hanya
    // mengalihkan ke `/login`, dan harus bisa dijangkau untuk melakukannya.
    if (pathname === "/admin/login") return NextResponse.next()

    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
    if (session) return NextResponse.next()

    // Satu pintu: admin yang belum masuk diarahkan ke `/login`, bukan lagi
    // halaman login admin terpisah. Login terpadu membaca peran akun dan
    // mengantar admin ke panel setelah masuk.
    return redirectToLogin(request, "/login", "next", `${pathname}${search}`)
  }

  // /profile/:path*
  const session = await verifyCustomerSession(request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value)
  if (session) return NextResponse.next()

  return redirectToLogin(request, "/login", "next", `${pathname}${search}`)
}

export const config = {
  matcher: ["/admin/:path*", "/profile/:path*"],
}
