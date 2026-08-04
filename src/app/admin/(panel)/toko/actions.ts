"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import {
  StoreOperationError,
  createStore as createStoreRow,
  softDeleteStore,
  updateStore as updateStoreRow,
  type StoreInput,
} from "@/lib/api/stores"
import { UnauthorizedError } from "@/lib/auth"
import { DAYS, type StoreHours } from "@/lib/utils/opening-hours"
import type { StoreActionState } from "./state"

/**
 * Jam dikirim sebagai tiga medan per hari (`closed-3`, `opens-3`, `closes-3`),
 * bukan satu medan JSON. Alasannya bukan gaya: formulir HTML biasa tetap bekerja
 * tanpa JavaScript, dan nilai yang datang sudah berupa string sederhana yang
 * mudah diperiksa — tidak ada tahap `JSON.parse` yang bisa melempar sebelum
 * lapisan pemeriksaan sempat memberi pesan yang bisa dibaca staff.
 */
function readHours(formData: FormData): StoreHours[] {
  return DAYS.map((day) => ({
    dayOfWeek: day,
    isClosed: formData.get(`closed-${day}`) === "on",
    opensAt: String(formData.get(`opens-${day}`) ?? "").trim(),
    closesAt: String(formData.get(`closes-${day}`) ?? "").trim(),
  }))
}

function readStoreInput(formData: FormData): StoreInput {
  return {
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    hours: readHours(formData),
    mapsUrl: String(formData.get("mapsUrl") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
  }
}

function revalidateStorePages() {
  revalidatePath("/admin/toko")
  revalidatePath("/stores")
  revalidatePath("/contact")
}

/**
 * Kesalahan yang sudah diantisipasi (nama bentrok, id terpakai, kolom kosong)
 * dikembalikan sebagai teks untuk ditampilkan di formulir. Sisanya dibiarkan
 * naik supaya kegagalan tak terduga tidak menyamar jadi pesan ramah.
 *
 * `redirect()` HARUS berada di luar `try`. Ia bekerja dengan melempar sinyal
 * khusus yang ditangkap Next; menaruhnya di dalam blok ini membuat sinyal itu
 * tertangkap `catch` dan perpindahan halamannya batal diam-diam — formulir
 * tampak menggantung padahal datanya sudah tersimpan.
 */
async function run(fn: () => Promise<void>): Promise<StoreActionState | never> {
  try {
    await requireAuth()
    await fn()
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof StoreOperationError) {
      return { error: error.message }
    }
    throw error
  }

  revalidateStorePages()
  redirect("/admin/toko")
}

export async function createStore(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  return run(() => createStoreRow(readStoreInput(formData)))
}

export async function updateStore(
  _prev: StoreActionState,
  formData: FormData
): Promise<StoreActionState> {
  return run(() => updateStoreRow(readStoreInput(formData)))
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
