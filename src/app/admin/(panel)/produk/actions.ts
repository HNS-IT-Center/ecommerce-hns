"use server"

import { revalidatePath, updateTag } from "next/cache"
import { UnauthorizedError, requirePermission } from "@/lib/auth"
import { CategoryOperationError } from "@/lib/api/woocommerce/categories"
import {
  bulkAssignCategory,
  previewBulkAssignCategory,
  deleteProduct,
  updateProduct,
  type BulkCategoryMode,
} from "@/lib/api/woocommerce/products"
import type { BulkApplyState, BulkPreviewState } from "./state"
import { getPrisma } from "@/lib/prisma/client"
import { buildProductLogEntries, diffProductChanges } from "@/lib/logs/product-log"
import {
  STOCK_DISPLAY_CACHE_TAG,
  isStockDisplayMode,
  saveStockDisplayMode,
  type StockDisplayMode,
} from "@/lib/api/stock-display"
import type { ProductInput } from "@/types/woocommerce"

/**
 * Pembersihan cache tinggal di sini, bukan di `lib/api` — lapisan data tidak
 * seharusnya tahu soal cache Next, dan `revalidateTag` hanya bisa dipanggil di
 * dalam konteks request. Itu juga yang membuat fungsi bulk bisa diuji dari
 * script di luar server.
 */
/**
 * `updateTag`, bukan `revalidateTag(tag, "max")`.
 *
 * Argumen kedua `revalidateTag` di Next 16 adalah masa hidup entri yang sudah
 * ditandai basi, dan `"max"` memberi umur paling panjang — permintaan
 * berikutnya masih disajikan dari cache lama, sehingga staff yang baru saja
 * mengubah harga tetap melihat angka sebelumnya. `updateTag` membuang entrinya
 * seketika. Berkas ini "use server", jadi syarat updateTag terpenuhi (fungsi itu
 * melempar kalau dipanggil dari route handler).
 *
 * `productIds` diisi kalau perubahannya menyangkut produk tertentu, supaya
 * halaman edit dan halaman produk publiknya ikut segar — bukan cuma daftar.
 */
function refresh(productIds: number[] = [], slugs: string[] = []) {
  updateTag("products")
  updateTag("all-products")
  updateTag("categories")

  for (const id of productIds) {
    updateTag(`product-id-${id}`)
    updateTag(`product-${id}-variations`)
  }
  for (const slug of slugs) {
    if (slug) updateTag(`product-${slug}`)
  }

  revalidatePath("/admin/produk")
}

function parseInput(formData: FormData) {
  const ids = String(formData.get("productIds") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)

  const categoryId = Number(formData.get("categoryId"))
  const rawMode = String(formData.get("mode") ?? "")
  const mode: BulkCategoryMode | null =
    rawMode === "add" || rawMode === "remove" ? rawMode : null

  return { ids, categoryId, mode }
}

/** Dry run — tidak ada satu baris pun yang ditulis. */
export async function previewBulkCategoryAction(
  _prev: BulkPreviewState,
  formData: FormData
): Promise<BulkPreviewState> {
  const { ids, categoryId, mode } = parseInput(formData)

  if (ids.length === 0) return { error: "Belum ada produk yang dipilih.", preview: null }
  if (Number.isNaN(categoryId)) return { error: "Kategori tidak valid.", preview: null }
  if (!mode) return { error: "Jenis perubahan tidak valid.", preview: null }

  try {
    await requirePermission("produk", "edit")
    return { error: null, preview: await previewBulkAssignCategory(ids, categoryId, mode) }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof CategoryOperationError) {
      return { error: error.message, preview: null }
    }
    throw error
  }
}

export async function applyBulkCategoryAction(
  _prev: BulkApplyState,
  formData: FormData
): Promise<BulkApplyState> {
  const { ids, categoryId, mode } = parseInput(formData)
  const acknowledged = Number(formData.get("acknowledgedChangeCount"))

  if (ids.length === 0) return { error: "Belum ada produk yang dipilih.", ok: null }
  if (Number.isNaN(categoryId)) return { error: "Kategori tidak valid.", ok: null }
  if (!mode) return { error: "Jenis perubahan tidak valid.", ok: null }
  if (Number.isNaN(acknowledged)) {
    return { error: "Konfirmasi jumlah perubahan tidak valid.", ok: null }
  }

  try {
    await requirePermission("produk", "edit")
    await bulkAssignCategory(ids, categoryId, mode, acknowledged)
    refresh(ids)
    return {
      error: null,
      ok:
        mode === "add"
          ? `Kategori ditambahkan ke ${acknowledged} produk.`
          : `Kategori dilepas dari ${acknowledged} produk.`,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof CategoryOperationError) {
      return { error: error.message, ok: null }
    }
    throw error
  }
}

export async function deleteProductAction(id: number) {
  try {
    const authUser = await requirePermission("produk", "edit")
    const userName = (authUser && typeof authUser === 'object' && 'name' in authUser) ? String(authUser.name) : "Admin"
    
    const prisma = getPrisma()
    const product = await prisma.product.findUnique({ where: { wooId: id } })
    
    await deleteProduct(id)
    
    if (product) {
      await prisma.productLog.create({
        data: {
          userName,
          productId: product.wooId,
          productName: product.name,
          action: "DELETE",
          fieldAffected: "all",
          oldValue: "Exists",
          newValue: "Deleted",
        }
      })
    }

    refresh(product ? [product.wooId] : [], product ? [product.slug] : [])
    return { error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: error.message }
    }
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Terjadi kesalahan saat menghapus produk." }
  }
}

export async function updateProductPriceAction(id: number, regularPrice: number, salePrice?: number | null) {
  try {
    const authUser = await requirePermission("produk", "edit")
    const userName = (authUser && typeof authUser === 'object' && 'name' in authUser) ? String(authUser.name) : "Admin"

    const prisma = getPrisma()
    const product = await prisma.product.findUnique({ where: { wooId: id } })
    if (!product) throw new Error("Produk tidak ditemukan")

    const updatePayload: ProductInput = {
      name: product.name,
      regular_price: String(regularPrice),
    }
    if (salePrice !== undefined) {
      updatePayload.sale_price = salePrice === null ? "" : String(salePrice)
    }

    await updateProduct(id, updatePayload)

    // Lewat helper yang sama dengan form edit produk, bukan string rakitan
    // sendiri. Sebelumnya jalur ini menulis `fieldAffected: "price"` dengan
    // nilai `"Regular: 100, Sale: 0"` — nama dan format yang tidak dikenali
    // penyaring maupun tampilan detail log, sehingga perubahan harga dari
    // daftar produk tidak bisa dibandingkan dengan yang dari form edit.
    //
    // `name` ikut dikirim ke Woo karena wajib, tapi nilainya diambil dari
    // produk yang sama sehingga tidak pernah terhitung sebagai perubahan.
    const entries = buildProductLogEntries(diffProductChanges(
      { ...product, categories: [], images: [] },
      updatePayload
    ))

    if (entries.length > 0) {
      await prisma.productLog.createMany({
        data: entries.map((entry) => ({
          userName,
          productId: product.wooId,
          productName: product.name,
          ...entry,
        })),
      })
    }

    refresh([id], [product.slug])
    return { error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: error.message }
    }
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Terjadi kesalahan saat mengupdate harga." }
  }
}

export async function bulkUpdateProductStatusAction(ids: number[], actionType: string) {
  try {
    const authUser = await requirePermission("produk", "edit")
    const userName = (authUser && typeof authUser === 'object' && 'name' in authUser) ? String(authUser.name) : "Admin"
    
    if (ids.length === 0) return { error: "Belum ada produk yang dipilih." }
    
    // Determine the field and value based on actionType
    let updateData: Partial<ProductInput> = {}
    let fieldAffected = ""
    let newValueStr = ""
    
    switch (actionType) {
      case "publish":
      case "draft":
      case "private":
        updateData = { status: actionType }
        fieldAffected = "status"
        newValueStr = actionType
        break
      case "outofstock":
      case "instock":
        updateData = { stock_status: actionType }
        fieldAffected = "stock_status"
        newValueStr = actionType
        break
      default:
        return { error: "Aksi tidak valid." }
    }

    const prisma = getPrisma()
    
    // Get existing products to log old values
    const products = await prisma.product.findMany({
      where: { wooId: { in: ids } }
    })

    const productMap = new Map(products.map(p => [p.wooId, p]))

    // Update in WooCommerce using Promise.all
    // Using individual updateProduct calls since the bulk API wrapper isn't strictly defined here,
    // or we can use updateProduct if bulk is not strictly needed per-spec, but Promise.all is fast enough for small batches.
    await Promise.all(ids.map(id => updateProduct(id, updateData)))

    // Log each change
    const logsData = ids.map(id => {
      const p = productMap.get(id)
      let oldValueStr = "unknown"
      if (p) {
        if (fieldAffected === "status") oldValueStr = p.status || "unknown"
        if (fieldAffected === "stock_status") oldValueStr = p.stockStatus || "unknown"
      }
      
      return {
        userName,
        productId: id,
        productName: p?.name || `Product #${id}`,
        action: `BULK_${fieldAffected.toUpperCase()}`,
        fieldAffected,
        oldValue: oldValueStr,
        newValue: newValueStr,
      }
    })

    if (logsData.length > 0) {
      await prisma.productLog.createMany({ data: logsData })
    }

    refresh(ids, products.map((p) => p.slug))
    return { error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: error.message }
    }
    return { error: "Gagal menerapkan perubahan massal." }
  }
}

/**
 * Sakelar global "tampilkan / sembunyikan stok habis".
 *
 * Yang ditulis hanya satu baris di tabel `settings` — `stockStatus` tiap produk
 * tidak disentuh sama sekali, jadi tidak ada yang perlu dipulihkan kalau staff
 * mengembalikan sakelarnya.
 *
 * `revalidatePath("/", "layout")` WAJIB ada dan tidak bisa digantikan oleh
 * `updateTag` saja. Tag itu hanya membuang hasil baca pengaturannya; HTML
 * halaman katalog dan halaman produk yang sudah ter-prerender masih memegang
 * label stok lama, dan gejalanya menyesatkan — sebagian halaman ikut berubah,
 * sebagian tidak.
 */
export async function updateStockDisplayModeAction(mode: StockDisplayMode) {
  try {
    await requirePermission("produk", "edit")

    if (!isStockDisplayMode(mode)) {
      return { error: "Mode tampilan stok tidak dikenali." }
    }

    await saveStockDisplayMode(mode)

    updateTag(STOCK_DISPLAY_CACHE_TAG)
    revalidatePath("/", "layout")
    revalidatePath("/admin/produk")

    return { error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { error: error.message }
    }
    return { error: "Gagal menyimpan pengaturan tampilan stok." }
  }
}
