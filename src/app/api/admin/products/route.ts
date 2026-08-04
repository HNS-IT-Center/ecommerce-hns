import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { createProduct, updateProduct } from "@/lib/api/woocommerce/products"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma/client"
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
    const ditolak = tolakKalauBelumMasuk(error)
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

    const STOCK_STATUS_MAP: Record<string, string> = {
      INSTOCK: "instock",
      OUTOFSTOCK: "outofstock",
      ONBACKORDER: "onbackorder",
    }
    const STATUS_MAP: Record<string, string> = {
      PUBLISHED: "publish",
      DRAFT: "draft",
      PRIVATE: "private",
    }

    const product = await updateProduct(id, input)
    
    if (existingRaw) {
      const changes: { field: string; old: unknown; new: unknown }[] = []

      if (input.name !== undefined && existingRaw.name !== input.name) {
        changes.push({ field: "name", old: existingRaw.name, new: input.name })
      }
      if (input.status !== undefined) {
        const oldStatus = STATUS_MAP[existingRaw.status] ?? existingRaw.status
        if (oldStatus !== input.status) {
          changes.push({ field: "status", old: oldStatus, new: input.status })
        }
      }
      if (input.short_description !== undefined && existingRaw.shortDescription !== input.short_description) {
        changes.push({ field: "short_description", old: "[Teks Panjang]", new: "[Teks Panjang Diubah]" })
      }
      if (input.description !== undefined && existingRaw.description !== input.description) {
        changes.push({ field: "description", old: "[Teks Panjang]", new: "[Teks Panjang Diubah]" })
      }
      if (input.regular_price !== undefined) {
        const oldRegular = existingRaw.regularPrice ? String(existingRaw.regularPrice) : ""
        if (oldRegular !== input.regular_price) {
          changes.push({ field: "regular_price", old: oldRegular, new: input.regular_price })
        }
      }
      if (input.sale_price !== undefined) {
        const oldSale = existingRaw.salePrice ? String(existingRaw.salePrice) : ""
        if (oldSale !== input.sale_price) {
          changes.push({ field: "sale_price", old: oldSale, new: input.sale_price })
        }
      }
      if (input.stock_status !== undefined) {
        const oldStockStatus = existingRaw.stockStatus
          ? STOCK_STATUS_MAP[existingRaw.stockStatus] ?? existingRaw.stockStatus
          : "instock"
        if (oldStockStatus !== input.stock_status) {
          changes.push({ field: "stock_status", old: oldStockStatus, new: input.stock_status })
        }
      }
      if (input.stock_quantity !== undefined) {
        const oldQty = existingRaw.stockQty !== null ? Number(existingRaw.stockQty) : null
        if (oldQty !== input.stock_quantity) {
          changes.push({ field: "stock_quantity", old: oldQty ?? 0, new: input.stock_quantity })
        }
      }
      if (input.categories !== undefined) {
        const oldCats = existingRaw.categories.map((c: { categoryId: number }) => c.categoryId).sort().join(",")
        const newCats = input.categories.map(c => c.id).sort().join(",")
        if (oldCats !== newCats) {
          changes.push({ field: "categories", old: oldCats, new: newCats })
        }
      }
      if (input.images !== undefined) {
        const oldImgs = existingRaw.images.map((img: { url: string }) => img.url).join(",")
        const newImgs = input.images.map(img => img.url).join(",")
        if (oldImgs !== newImgs) {
          changes.push({ field: "images", old: oldImgs, new: newImgs })
        }
      }

      if (changes.length > 0) {
        let fieldAffected = changes[0].field
        let oldValueStr = String(changes[0].old)
        let newValueStr = String(changes[0].new)

        if (changes.length > 1) {
          fieldAffected = "multiple"
          const oldObj: Record<string, unknown> = {}
          const newObj: Record<string, unknown> = {}
          for (const change of changes) {
            oldObj[change.field] = change.old
            newObj[change.field] = change.new
          }
          oldValueStr = JSON.stringify(oldObj)
          newValueStr = JSON.stringify(newObj)
        }

        await prisma.productLog.create({
          data: {
            userName,
            productId: product.id,
            productName: product.name,
            action: "EDIT_PRODUCT",
            fieldAffected,
            oldValue: oldValueStr,
            newValue: newValueStr,
          },
        })
      }
    }
    
    revalidatePath("/admin/produk")
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error)
    if (ditolak) return ditolak
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
