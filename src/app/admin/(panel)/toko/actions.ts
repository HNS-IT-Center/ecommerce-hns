"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import {
  createStore as createStoreRow,
  softDeleteStore,
  updateStore as updateStoreRow,
  type StoreInput,
} from "@/lib/api/stores"

function readStoreInput(formData: FormData): StoreInput {
  return {
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    hours: String(formData.get("hours") ?? "").trim(),
    mapsUrl: String(formData.get("mapsUrl") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  }
}

function revalidateStorePages() {
  revalidatePath("/admin/toko")
  revalidatePath("/stores")
  revalidatePath("/contact")
}

export async function createStore(formData: FormData) {
  await requireAuth()
  await createStoreRow(readStoreInput(formData))
  revalidateStorePages()
  redirect("/admin/toko")
}

export async function updateStore(formData: FormData) {
  await requireAuth()
  await updateStoreRow(readStoreInput(formData))
  revalidateStorePages()
  redirect("/admin/toko")
}

/**
 * Menandai toko terhapus, bukan melenyapkan barisnya.
 *
 * Identitas penghapus diambil dari `requireAuth()`, BUKAN dari formulir. Nilai
 * apa pun yang datang dari formulir bisa diganti pengirimnya, dan jejak audit
 * yang bisa dipalsukan oleh pelakunya sendiri tidak ada gunanya sebagai jejak.
 */
export async function deleteStore(formData: FormData) {
  const user = await requireAuth()
  const id = String(formData.get("id") ?? "")
  if (!id) return

  await softDeleteStore(id, user.id)
  revalidateStorePages()
}
