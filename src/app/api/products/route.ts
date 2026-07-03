import { NextRequest, NextResponse } from "next/server"
import { getProducts } from "@/lib/api/woocommerce/products"
import { getCategories } from "@/lib/api/woocommerce/categories"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const categorySlug = searchParams.get("categorySlug")
  const search = searchParams.get("search")
  const per_page = searchParams.get("per_page") || "10"

  try {
    let categoryId: number | undefined = undefined

    // Translate categorySlug to categoryId
    if (categorySlug) {
      const categories = await getCategories({ slug: categorySlug })
      if (categories && categories.length > 0) {
        categoryId = categories[0].id
      }
    }

    // If a category slug was provided but no ID found, we can fallback to search keyword
    const finalSearch = (!categoryId && categorySlug && !search) ? categorySlug : search

    const products = await getProducts({
      category: categoryId,
      search: finalSearch || undefined,
      perPage: parseInt(per_page),
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}
