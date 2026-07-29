"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { CategoryOperationError } from "@/lib/api/woocommerce/categories"
import {
  bulkAssignCategory,
  previewBulkAssignCategory,
  type BulkAssignPreview,
  type BulkCategoryMode,
} from "@/lib/api/woocommerce/products"

export type BulkPreviewState = { error: string | null; preview: BulkAssignPreview | null }
export type BulkApplyState = { error: string | null; ok: string | null }

export const EMPTY_BULK_PREVIEW: BulkPreviewState = { error: null, preview: null }
export const EMPTY_BULK_APPLY: BulkApplyState = { error: null, ok: null }

/**
 * Pembersihan cache tinggal di sini, bukan di `lib/api` — lapisan data tidak
 * seharusnya tahu soal cache Next, dan `revalidateTag` hanya bisa dipanggil di
 * dalam konteks request. Itu juga yang membuat fungsi bulk bisa diuji dari
 * script di luar server.
 */
function refresh() {
  revalidateTag("products", "max")
  revalidateTag("categories", "max")
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
    await requireAuth()
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
    await requireAuth()
    await bulkAssignCategory(ids, categoryId, mode, acknowledged)
    refresh()
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
