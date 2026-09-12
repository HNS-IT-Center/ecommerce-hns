import { NextRequest, NextResponse } from "next/server"
import { getProductVariations } from "@/lib/api/woocommerce/products"
import { displayVariationStock, getStockDisplayMode } from "@/lib/api/stock-display"

/**
 * Varian satu produk untuk Quick View di katalog.
 *
 * Kartu produk tidak membawa data varian — satu halaman katalog berisi puluhan
 * kartu, dan menyertakan varian di semuanya berarti menarik ribuan baris untuk
 * modal yang mungkin tidak pernah dibuka. Modal memuatnya saat benar-benar
 * dibutuhkan.
 *
 * Endpoint publik dan memakai versi ber-cache: isinya hanya dibaca, tidak
 * pernah dipakai untuk menulis.
 */
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Parameter id tidak valid" }, { status: 400 })
  }

  try {
    // Quick View memakai jalur ini, jadi sakelar tampilan stok harus berlaku
    // di sini juga — kalau tidak, satu produk bisa tampak "Tersedia" di
    // halaman produk tapi "Habis" di modal katalog.
    const stockDisplayMode = await getStockDisplayMode()
    const variations = (await getProductVariations(id)).map((variation) =>
      displayVariationStock(variation, stockDisplayMode)
    )
    return NextResponse.json(variations)
  } catch (error) {
    console.error("Failed to load variations:", error)
    return NextResponse.json({ error: "Gagal memuat varian" }, { status: 500 })
  }
}
