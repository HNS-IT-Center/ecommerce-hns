import { NextRequest, NextResponse } from "next/server"
import { getProductVariationsFresh } from "@/lib/api/woocommerce/products"
import { UnauthorizedError, requireAuth } from "@/lib/auth"

/**
 * Varian satu produk, untuk Quick Edit di daftar produk admin.
 *
 * Daftar produk sengaja tidak ikut membawa varian di setiap barisnya: 25 produk
 * per halaman dengan varian lengkap menambah beban query yang nyata, padahal
 * Quick Edit hanya dibuka untuk satu produk pada satu waktu. Modal memuatnya
 * lewat endpoint ini saat benar-benar dibuka.
 *
 * Versi "Fresh" (tanpa cache) dipakai karena isinya langsung disimpan kembali —
 * memuat salinan lama berarti menulis ulang data usang.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const id = Number(request.nextUrl.searchParams.get("id"))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Parameter id tidak valid" }, { status: 400 })
    }

    const variations = await getProductVariationsFresh(id)
    return NextResponse.json(variations)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error("Failed to load variations:", error)
    return NextResponse.json({ error: "Gagal memuat varian" }, { status: 500 })
  }
}
