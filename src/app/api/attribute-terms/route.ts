import { NextRequest, NextResponse } from "next/server"
import { getProductAttributes, getProductAttributeTerms } from "@/lib/api/woocommerce/products"

export async function GET(request: NextRequest) {
  const attributeSlug = request.nextUrl.searchParams.get("attributeSlug")

  if (!attributeSlug) {
    return NextResponse.json({ error: "attributeSlug is required" }, { status: 400 })
  }

  try {
    const attributes = await getProductAttributes()
    const attribute = attributes.find((a) => a.slug === attributeSlug)

    if (!attribute) {
      return NextResponse.json([])
    }

    const terms = await getProductAttributeTerms(attribute.id)
    return NextResponse.json(terms)
  } catch (error) {
    console.error("API Route Error:", error)
    return NextResponse.json({ error: "Failed to fetch attribute terms" }, { status: 500 })
  }
}
