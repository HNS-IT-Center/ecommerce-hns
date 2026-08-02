import { NextRequest, NextResponse } from "next/server"
import { createProduct, updateProduct, getProductById } from "@/lib/api/woocommerce/products"
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
    
    const existingProduct = await getProductById(id)
    const product = await updateProduct(id, input)
    
    if (existingProduct) {
      const changes: { field: string; old: any; new: any }[] = []
      
      if (input.name !== undefined && existingProduct.name !== input.name) {
        changes.push({ field: "name", old: existingProduct.name, new: input.name })
      }
      if (input.status !== undefined && existingProduct.status !== input.status) {
        changes.push({ field: "status", old: existingProduct.status, new: input.status })
      }
      if (input.short_description !== undefined && existingProduct.short_description !== input.short_description) {
        changes.push({ field: "short_description", old: existingProduct.short_description || "", new: input.short_description })
      }
      if (input.description !== undefined && existingProduct.description !== input.description) {
        changes.push({ field: "description", old: existingProduct.description || "", new: input.description })
      }
      if (input.regular_price !== undefined && existingProduct.regular_price !== input.regular_price) {
        changes.push({ field: "regular_price", old: existingProduct.regular_price || "", new: input.regular_price })
      }
      if (input.sale_price !== undefined && existingProduct.sale_price !== input.sale_price) {
        changes.push({ field: "sale_price", old: existingProduct.sale_price || "", new: input.sale_price })
      }
      if (input.stock_quantity !== undefined && existingProduct.stock_quantity !== input.stock_quantity) {
        changes.push({ field: "stock_quantity", old: existingProduct.stock_quantity || 0, new: input.stock_quantity })
      }
      if (input.categories !== undefined) {
        // Just log that categories changed
        const oldCats = existingProduct.categories.map(c => c.id).sort().join(',')
        const newCats = input.categories.map(c => c.id).sort().join(',')
        if (oldCats !== newCats) {
          changes.push({ field: "categories", old: oldCats, new: newCats })
        }
      }
      if (input.images !== undefined) {
        const oldImgs = existingProduct.images.map(img => img.src).join(',')
        const newImgs = input.images.map(img => img.url).join(',')
        if (oldImgs !== newImgs) {
          changes.push({ field: "images", old: oldImgs, new: newImgs })
        }
      }
      
      if (changes.length > 0) {
        const prisma = getPrisma()
        
        let fieldAffected = changes[0].field
        let oldValueStr = String(changes[0].old)
        let newValueStr = String(changes[0].new)
        
        if (changes.length > 1) {
          fieldAffected = "multiple"
          const oldObj: Record<string, any> = {}
          const newObj: Record<string, any> = {}
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
          }
        })
      }
    }
    
    return NextResponse.json(product)
  } catch (error) {
    const ditolak = tolakKalauBelumMasuk(error)
    if (ditolak) return ditolak
    console.error("Failed to update product:", error)
    return NextResponse.json({ error: "Gagal menyimpan produk" }, { status: 500 })
  }
}
