"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { UnauthorizedError, requireAuth } from "@/lib/auth"
import {
  CategoryOperationError,
  createCategory,
  deleteCategory,
  mergeCategory,
  moveCategory,
  previewMergeCategory,
  renameCategory,
} from "@/lib/api/woocommerce/categories"
import type { CategoryActionState, MergePreviewState } from "./state"

/**
 * Pembersihan cache tinggal di sini, bukan di `lib/api`. Lapisan data tidak
 * seharusnya tahu soal cache Next, dan `revalidateTag` memang hanya bisa
 * dipanggil di dalam konteks request — menaruhnya di sana membuat fungsinya
 * mustahil dipakai dari script maupun diuji di luar server.
 */
function refresh() {
  revalidateTag("categories", "max")
  // Memindahkan kategori mengubah isi halaman kategori di storefront tanpa
  // menyentuh satu produk pun, jadi cache daftar produk ikut dibuang — kalau
  // tidak, PIC melihat pohon yang sudah rapi sementara pengunjung masih
  // mendapat susunan lama sampai cache kedaluwarsa sendiri.
  revalidateTag("products", "max")
  revalidatePath("/admin/kategori")
  revalidatePath("/admin/produk")
}

/**
 * Kesalahan yang sudah diantisipasi (nama bentrok, kategori beranak, produk
 * masih menempel) dikembalikan sebagai teks untuk ditampilkan di layar. Sisanya
 * dibiarkan naik supaya tidak ada kegagalan tak terduga yang menyamar jadi
 * pesan ramah.
 *
 * Pemeriksaan sesi ikut di sini, bukan diulang di tiap aksi. Proxy sudah
 * menjaga navigasi halaman, tapi server action punya alamatnya sendiri dan bisa
 * di-POST langsung tanpa pernah membuka satu halaman pun — jadi setiap aksi
 * tetap harus bertanya sendiri.
 */
async function run(
  fn: () => Promise<void>,
  ok: string
): Promise<CategoryActionState> {
  try {
    await requireAuth()
    await fn()
    refresh()
    return { error: null, ok }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof CategoryOperationError) {
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

export async function moveCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const id = Number(formData.get("id"))
  const rawParent = String(formData.get("parentId") ?? "")
  const parentId = rawParent === "" ? null : Number(rawParent)

  if (Number.isNaN(id)) return { error: "Kategori tidak valid.", ok: null }
  if (parentId !== null && Number.isNaN(parentId)) {
    return { error: "Kategori tujuan tidak valid.", ok: null }
  }

  return run(() => moveCategory(id, parentId), "Kategori dipindahkan.")
}

/**
 * Dampak dihitung di server karena hanya server yang tahu kaitan produk —
 * layar admin cuma memegang jumlah per kategori, bukan produk mana saja yang
 * sudah ada di kedua sisi.
 */
export async function previewMergeCategoryAction(
  _prev: MergePreviewState,
  formData: FormData
): Promise<MergePreviewState> {
  const sourceId = Number(formData.get("sourceId"))
  const targetId = Number(formData.get("targetId"))

  if (Number.isNaN(sourceId) || Number.isNaN(targetId)) {
    return { error: "Kategori tidak valid.", preview: null }
  }

  try {
    // Preview pun dijaga: ia membaca jumlah produk per kategori, dan itu
    // gambaran isi katalog yang tidak perlu terbuka bagi siapa saja.
    await requireAuth()
    return { error: null, preview: await previewMergeCategory(sourceId, targetId) }
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof CategoryOperationError) {
      return { error: error.message, preview: null }
    }
    throw error
  }
}

export async function mergeCategoryAction(
  _prev: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const sourceId = Number(formData.get("sourceId"))
  const targetId = Number(formData.get("targetId"))
  const acknowledged = Number(formData.get("acknowledgedMoveCount"))

  if (Number.isNaN(sourceId) || Number.isNaN(targetId)) {
    return { error: "Kategori tidak valid.", ok: null }
  }
  if (Number.isNaN(acknowledged)) {
    return { error: "Konfirmasi jumlah produk tidak valid.", ok: null }
  }

  return run(
    () => mergeCategory(sourceId, targetId, acknowledged),
    "Kategori digabungkan."
  )
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
