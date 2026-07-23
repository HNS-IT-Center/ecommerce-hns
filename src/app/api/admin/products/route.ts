import { NextRequest, NextResponse } from "next/server"
import { createProduct, updateProduct } from "@/lib/api/woocommerce/products"
import type { ProductInput } from "@/types/woocommerce"

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as ProductInput
    const product = await createProduct(input)
    return NextResponse.json(product)
  } catch (error) {
    console.error("Failed to create product:", error)
    return NextResponse.json({ error: "Gagal membuat produk" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as ProductInput & { id: number }
    const { id, ...input } = body
    const product = await updateProduct(id, input)
    return NextResponse.json(product)
  } catch (error) {
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
