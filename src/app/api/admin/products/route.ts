import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createProduct, updateProduct, ProductVariationError } from "@/lib/api/woocommerce/products"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma/client"
import { buildProductLogEntries, diffProductChanges } from "@/lib/logs/product-log"
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

/**
 * Penolakan varian bukan kegagalan server — admin bisa memperbaikinya sendiri
 * (mis. hapus varian dulu), jadi pesannya diteruskan apa adanya dengan 400.
 */
function tolakKalauVarianBermasalah(error: unknown) {
  return error instanceof ProductVariationError
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : null
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await requireAuth()
    const userName = (authUser && typeof authUser === 'object' && 'name' in authUser) ? String(authUser.name) : "Admin"
    
    const input = (await request.json()) as ProductInput
    const product = await createProduct(input)
    
    const prisma = getPrisma()
    await prisma.productLog.create({
      data: {
        userName,
        productId: product.id,
        productName: product.name,
        action: "UPLOAD_PRODUCTS",
        fieldAffected: "all",
        oldValue: "None",
        newValue: "Created",
      }
    })
    
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error) ?? tolakKalauVarianBermasalah(error)
    if (ditolak) return ditolak
    console.error("Failed to create product:", error)
    return NextResponse.json({ error: "Gagal membuat produk" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authUser = await requireAuth()
    const userName = (authUser && typeof authUser === 'object' && 'name' in authUser) ? String(authUser.name) : "Admin"
    
    const body = (await request.json()) as ProductInput & { id: number }
    const { id, ...input } = body
    
    // Ambil snapshot sebelum update langsung dari DB (TANPA cache) supaya perbandingan
    // selalu akurat — getProductById memakai unstable_cache dan bisa mengembalikan
    // nilai lama yang sudah tidak tepat, sehingga perubahan arah tertentu (mis.
    // instock→outofstock) tidak terdeteksi dan tidak dicatat di log.
    const prisma = getPrisma()
    const existingRaw = await prisma.product.findUnique({
      where: { wooId: id },
      include: {
        categories: true,
        images: true,
      },
    })

    const product = await updateProduct(id, input)

    if (existingRaw) {
      // Perubahan harga selalu dipisah jadi barisnya sendiri — menyunting nama
      // dan harga sekaligus menghasilkan dua baris log, bukan satu. Aturannya
      // ada di `lib/logs/product-log.ts` bersama jalur quick edit harga, supaya
      // nama field dan format nilainya tidak berbeda antar jalur.
      const entries = buildProductLogEntries(diffProductChanges(existingRaw, input))

      if (entries.length > 0) {
        await prisma.productLog.createMany({
          data: entries.map((entry) => ({
            userName,
            productId: product.id,
            productName: product.name,
            ...entry,
          })),
        })
      }
    }

    revalidatePath("/admin/produk")
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error) ?? tolakKalauVarianBermasalah(error)
    if (ditolak) return ditolak
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
