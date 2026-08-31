"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requireAuth } from "@/lib/auth"
import {
  BANNERS_CACHE_TAG,
  createBanner as createBannerRow,
  deleteBanner as deleteBannerRow,
  updateBanner as updateBannerRow,
  reorderBanners as reorderBannerRows,
  type BannerInput,
} from "@/lib/api/banners"
import {
  createBatch as createBatchRow,
  softDeleteBatch as softDeleteBatchRow,
  updateBatch as updateBatchRow,
  type BatchOption,
} from "@/lib/api/banner-batches"

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim()
  return value || null
}

/**
 * Tanggal dari `<input type="date">` tidak berzona waktu.
 *
 * Mulai dihitung dari awal hari, berakhir pada penghujung hari — supaya promo
 * yang dijadwalkan "sampai 31 Desember" benar-benar tayang sepanjang tanggal
 * itu, bukan mati pada dini harinya.
 */
function parseDateInput(value: string, edge: "start" | "end"): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return new Date(`${trimmed}T${edge === "start" ? "00:00:00" : "23:59:59"}`)
}

function readDate(formData: FormData, key: string, edge: "start" | "end"): Date | null {
  return parseDateInput(String(formData.get(key) ?? ""), edge)
}

function readBannerInput(formData: FormData): BannerInput {
  const rawDisplayMode = String(formData.get("displayMode") ?? "IMAGE_TEXT").trim()
  const displayMode = rawDisplayMode === "IMAGE_ONLY" ? "IMAGE_ONLY" as const : "IMAGE_TEXT" as const

  return {
    tag: optionalText(formData, "tag"),
    title: String(formData.get("title") ?? "").trim(),
    subtitle: optionalText(formData, "subtitle"),
    ctaLabel: optionalText(formData, "ctaLabel"),
    ctaHref: optionalText(formData, "ctaHref"),
    imageUrl: optionalText(formData, "imageUrl"),
    bgClass: String(formData.get("bgClass") ?? "bg-primary").trim() || "bg-primary",
    displayMode,
    // Kosong berarti "Tanpa kampanye" — kolomnya nullable dan banner tanpa
    // batch berdiri sendiri.
    batchId: optionalText(formData, "batchId"),
    isActive: formData.get("isActive") === "on",
    startsAt: readDate(formData, "startsAt", "start"),
    endsAt: readDate(formData, "endsAt", "end"),
  }
}

function revalidateBannerPages() {
  // Tag dipakai oleh cache di getActiveBanners; path beranda dibersihkan
  // terpisah karena halamannya sendiri ikut di-cache sebagai halaman.
  revalidateTag(BANNERS_CACHE_TAG, "max")
  revalidatePath("/admin/banner")
  revalidatePath("/")
}

export async function createBanner(formData: FormData) {
  await requireAuth()
  await createBannerRow(readBannerInput(formData))
  revalidateBannerPages()
  redirect("/admin/banner")
}

export async function updateBanner(formData: FormData) {
  await requireAuth()
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await updateBannerRow(id, readBannerInput(formData))
  revalidateBannerPages()
  redirect("/admin/banner")
}

export async function deleteBanner(formData: FormData) {
  await requireAuth()
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await deleteBannerRow(id)
  revalidateBannerPages()
}

// --------------------------------------------------------------------------- batch

/**
 * Nilai mentah dari formulir kampanye.
 *
 * Tanggalnya tetap berupa "YYYY-MM-DD" seperti yang dikeluarkan
 * `<input type="date">`, bukan `Date` — supaya penentuan awal/penghujung hari
 * terjadi di satu tempat saja (`parseDateInput`), sama seperti jadwal banner.
 */
export type BatchValues = {
  name: string
  isActive: boolean
  startsAt: string
  endsAt: string
}

export type BatchActionResult =
  | { success: true; batch: BatchOption }
  | { success: false; error: string }

export type ActionResult = { success: true } | { success: false; error: string }

const BatchSchema = z.object({
  // 150 mengikuti `@db.VarChar(150)` di prisma/schema.prisma. Tanpa batas di
  // sini, nama yang kepanjangan baru ditolak oleh MariaDB sebagai galat mentah.
  name: z.string().trim().min(1, "Nama kampanye wajib diisi").max(150, "Nama kampanye terlalu panjang (maksimal 150 karakter)"),
  isActive: z.boolean(),
  startsAt: z.string(),
  endsAt: z.string(),
})

function readBatchInput(values: BatchValues):
  | { ok: true; data: { name: string; isActive: boolean; startsAt: Date | null; endsAt: Date | null } }
  | { ok: false; error: string } {
  const parsed = BatchSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const startsAt = parseDateInput(parsed.data.startsAt, "start")
  const endsAt = parseDateInput(parsed.data.endsAt, "end")

  // Rentang terbalik tidak akan pernah tayang sedetik pun, dan diam-diam
  // mematikan seluruh banner anggotanya. Lebih baik ditolak di sini daripada
  // dicari sebabnya lewat beranda yang kosong.
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "Tanggal berakhir jatuh sebelum tanggal mulai." }
  }

  return { ok: true, data: { name: parsed.data.name, isActive: parsed.data.isActive, startsAt, endsAt } }
}

export async function createBannerBatch(values: BatchValues): Promise<BatchActionResult> {
  await requireAuth()

  const input = readBatchInput(values)
  if (!input.ok) return { success: false, error: input.error }

  const batch = await createBatchRow(input.data)
  revalidateBannerPages()
  return { success: true, batch }
}

export async function updateBannerBatch(
  id: string,
  values: BatchValues
): Promise<BatchActionResult> {
  await requireAuth()
  if (!id) return { success: false, error: "Kampanye tidak ditemukan." }

  const input = readBatchInput(values)
  if (!input.ok) return { success: false, error: input.error }

  const batch = await updateBatchRow(id, input.data)
  revalidateBannerPages()
  return { success: true, batch }
}

export async function deleteBannerBatch(id: string): Promise<ActionResult> {
  await requireAuth()
  if (!id) return { success: false, error: "Kampanye tidak ditemukan." }

  await softDeleteBatchRow(id)
  revalidateBannerPages()
  return { success: true }
}

/**
 * Menyimpan urutan hasil seret di tab "Banner".
 *
 * `ids` wajib memuat SELURUH banner — daftar sebagian akan membuat nomor yang
 * tidak ikut ditulis bertabrakan dengan yang baru (lihat `reorderBanners` di
 * lapisan data).
 */
export async function reorderBanners(ids: string[]): Promise<ActionResult> {
  await requireAuth()

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "Urutan kosong." }
  }

  // Id ganda berarti ada baris yang menerima dua nomor sekaligus; yang belakangan
  // menang dan satu banner ikut bergeser tanpa ada yang menyentuhnya.
  if (new Set(ids).size !== ids.length) {
    return { success: false, error: "Urutan tidak sah (ada id ganda)." }
  }

  await reorderBannerRows(ids)
  revalidateBannerPages()
  return { success: true }
}
