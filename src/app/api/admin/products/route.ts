import { NextRequest, NextResponse } from "next/server"
import { createProduct, updateProduct } from "@/lib/api/woocommerce/products"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import type { ProductInput } from "@/types/woocommerce"

/**
 * Form produk mengirim ke sini lewat `fetch`, bukan lewat server action, jadi
 * endpoint ini berada di /api dan tidak tersentuh proxy yang menjaga /admin.
 * Tanpa pemeriksaan di bawah, membuat dan menyunting produk tetap terbuka bagi
 * siapa pun yang tahu alamatnya — termasuk mengubah harga seluruh katalog.
 */
function tolakKalauBelumMasuk(error: unknown) {
  return error instanceof UnauthorizedError
    ? NextResponse.json({ error: error.message }, { status: 401 })
    : null
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const input = (await request.json()) as ProductInput
    const product = await createProduct(input)
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error)
    if (ditolak) return ditolak
    console.error("Failed to create product:", error)
    return NextResponse.json({ error: "Gagal membuat produk" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth()
    const body = (await request.json()) as ProductInput & { id: number }
    const { id, ...input } = body
    const product = await updateProduct(id, input)
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error)
    if (ditolak) return ditolak
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
