import { NextRequest, NextResponse } from "next/server"
import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 15

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json([])
  }

  try {
    const wooProducts = await getProducts({ search: q, perPage: RESULT_LIMIT })
    const stockDisplayMode = await getStockDisplayMode()
    const products = wooProducts.map((p) => mapWooProductToUI(p, stockDisplayMode))
    return NextResponse.json(products)
  } catch (error) {
    console.error("Search API Error:", error)
    return NextResponse.json({ error: "Gagal mencari produk" }, { status: 500 })
  }
}
