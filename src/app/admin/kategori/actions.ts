"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import {
  CategoryOperationError,
  createCategory,
  deleteCategory,
  renameCategory,
} from "@/lib/api/woocommerce/categories"

export type CategoryActionState = { error: string | null; ok: string | null }

export const EMPTY_STATE: CategoryActionState = { error: null, ok: null }

/**
 * Pembersihan cache tinggal di sini, bukan di `lib/api`. Lapisan data tidak
 * seharusnya tahu soal cache Next, dan `revalidateTag` memang hanya bisa
 * dipanggil di dalam konteks request — menaruhnya di sana membuat fungsinya
 * mustahil dipakai dari script maupun diuji di luar server.
 */
function refresh() {
  revalidateTag("categories", "max")
  revalidatePath("/admin/kategori")
  revalidatePath("/admin/produk")
}

/**
 * Kesalahan yang sudah diantisipasi (nama bentrok, kategori beranak, produk
 * masih menempel) dikembalikan sebagai teks untuk ditampilkan di layar. Sisanya
 * dibiarkan naik supaya tidak ada kegagalan tak terduga yang menyamar jadi
 * pesan ramah.
 */
async function run(
  fn: () => Promise<void>,
  ok: string
): Promise<CategoryActionState> {
  try {
    await fn()
    refresh()
    return { error: null, ok }
  } catch (error) {
    if (error instanceof CategoryOperationError) {
      return { error: error.message, ok: null }
    }
    throw error
  }
}

export async function createCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const name = String(formData.get("name") ?? "")
  const rawParent = String(formData.get("parentId") ?? "")
  const parentId = rawParent === "" ? null : Number(rawParent)

  if (parentId !== null && Number.isNaN(parentId)) {
    return { error: "Kategori induk tidak valid.", ok: null }
  }

  return run(() => createCategory(name, parentId), `Kategori "${name.trim()}" dibuat.`)
}

export async function renameCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = Number(formData.get("id"))
  const name = String(formData.get("name") ?? "")

  if (Number.isNaN(id)) return { error: "Kategori tidak valid.", ok: null }

  return run(() => renameCategory(id, name), `Nama diubah jadi "${name.trim()}".`)
}

export async function deleteCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = Number(formData.get("id"))
  const raw = String(formData.get("acknowledgedProductCount") ?? "")
  const acknowledged = raw === "" ? null : Number(raw)

  if (Number.isNaN(id)) return { error: "Kategori tidak valid.", ok: null }
  if (acknowledged !== null && Number.isNaN(acknowledged)) {
    return { error: "Konfirmasi jumlah produk tidak valid.", ok: null }
  }

  return run(() => deleteCategory(id, acknowledged), "Kategori dihapus.")
}
