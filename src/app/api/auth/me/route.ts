import { NextResponse } from "next/server"
import { getCurrentCustomer } from "@/lib/auth/customer"

/**
 * Status login pelanggan, untuk dipanggil dari Client Component.
 *
 * Sengaja BUKAN dibaca langsung dari Server Component (Header/RootLayout)
 * yang membungkus seluruh halaman: `getCurrentCustomer()` memanggil
 * `cookies()`, dan Next.js menandai SETIAP halaman yang me-render pemanggil
 * itu sebagai dynamic — termasuk /cart, /checkout, /faq, dan seluruh halaman
 * kebijakan yang sebelumnya statis. Satu status login di pojok header tidak
 * sepadan dengan kehilangan prerendering di seluruh storefront.
 *
 * Endpoint kecil ini dipanggil via `fetch` dari `AccountNav`/`MobileDock`
 * setelah mount, sama seperti `CartBadge` menunda tampilan jumlah keranjang
 * sampai hydrated — hanya di sini datanya dari server, bukan localStorage.
 */
export async function GET() {
  const customer = await getCurrentCustomer()
  return NextResponse.json({ customer })
}
