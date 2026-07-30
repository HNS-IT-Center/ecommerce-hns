import { NextRequest, NextResponse } from "next/server"
import { getProducts } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 15

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json([])
  }

  try {
    const wooProducts = await getProducts({ search: q, perPage: RESULT_LIMIT })
    const products = wooProducts.map(mapWooProductToUI)
    return NextResponse.json(products)
  } catch (error) {
    console.error("Search API Error:", error)
    return NextResponse.json({ error: "Gagal mencari produk" }, { status: 500 })
  }
}
