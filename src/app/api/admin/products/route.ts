import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import {
  createProduct,
  updateProduct,
  ProductSkuError,
  ProductVariationError,
} from "@/lib/api/woocommerce/products"
import { Prisma } from "@prisma/client"
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

/**
 * SKU kembar. Dua jalur bisa sampai ke sini:
 *
 *   1. pemeriksaan di `products.ts`, yang sudah menyebut nama pemiliknya, dan
 *   2. constraint unik database — untuk dua staff yang menyimpan SKU sama pada
 *      saat yang hampir sama, saat pemeriksaan (1) masih melihat kolom kosong.
 *
 * `meta.target` diperiksa karena tabel produk punya beberapa kolom unik (slug,
 * `accurate_code`): membalas "SKU sudah dipakai" untuk pelanggaran slug akan
 * mengirim staff memperbaiki kolom yang sama sekali tidak bermasalah.
 */
function tolakKalauSkuBentrok(error: unknown) {
  if (error instanceof ProductSkuError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return null
  }
  return JSON.stringify(error.meta?.target ?? "").toLowerCase().includes("sku")
    ? NextResponse.json(
        { error: "SKU itu baru saja dipakai produk lain. Pakai SKU lain." },
        { status: 409 },
      )
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
    const ditolak =
      tolakKalauBelumMasuk(error) ??
      tolakKalauVarianBermasalah(error) ??
      tolakKalauSkuBentrok(error)
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
    const ditolak =
      tolakKalauBelumMasuk(error) ??
      tolakKalauVarianBermasalah(error) ??
      tolakKalauSkuBentrok(error)
    if (ditolak) return ditolak
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
