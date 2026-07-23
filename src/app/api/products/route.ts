import { NextRequest, NextResponse } from "next/server"
import { getProducts } from "@/lib/api/woocommerce/products"
import { getCategories } from "@/lib/api/woocommerce/categories"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const categorySlug = searchParams.get("categorySlug")
  const search = searchParams.get("search")
  const per_page = searchParams.get("per_page") || "10"
  const attribute = searchParams.get("attribute")
  const attributeTerm = searchParams.get("attributeTerm")

  try {
    const categoryIds: number[] = []

    // categorySlug boleh berisi lebih dari satu slug (dipisah koma) untuk gabungan
    // beberapa sub-kategori jadi satu hasil (mis. "SSD NVMe" + "SSD SATA" + "HDD").
    if (categorySlug) {
      const slugs = categorySlug.split(",").map((s) => s.trim()).filter(Boolean)
      for (const slug of slugs) {
        const categories = await getCategories({ slug })
        if (categories && categories.length > 0) {
          categoryIds.push(categories[0].id)
        }
      }
    }

    // Kalau cuma 1 slug diberikan dan tidak match kategori manapun, fallback ke
    // pencarian keyword (perilaku lama). Kalau lebih dari 1 slug, semuanya sudah
    // dikurasi lewat kode (bukan input user), jadi tidak perlu fallback ini.
    const singleSlugNoMatch = categorySlug && !categorySlug.includes(",") && categoryIds.length === 0
    const finalSearch = (singleSlugNoMatch && !search) ? categorySlug : search

    const products = await getProducts({
      category: categoryIds.length > 0 ? categoryIds.join(",") : undefined,
      search: finalSearch || undefined,
      perPage: parseInt(per_page),
      attribute: attribute || undefined,
      attributeTerm: attributeTerm || undefined,
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
