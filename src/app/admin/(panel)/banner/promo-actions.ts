"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { requirePermission } from "@/lib/auth"
import { BANNERS_CACHE_TAG } from "@/lib/api/banners"
import {
  PROMOS_CACHE_TAG,
  PromoSlugTakenError,
  createPromo as createPromoRow,
  searchPromoPickerProducts,
  softDeletePromo as softDeletePromoRow,
  updatePromo as updatePromoRow,
  type PromoInput,
  type PromoPickerProduct,
} from "@/lib/api/promos"
import { parseDateInput } from "@/lib/utils/banner"
import { PROMO_SLUG_PATTERN } from "@/lib/utils/promo"

/**
 * Halaman promo memakai izin yang sama dengan banner (`banner`). Promo hanya
 * berarti sesuatu kalau ada banner yang menautnya, dan staff yang menyusun
 * banner itulah yang menyusun isinya — izin terpisah hanya membuka keadaan
 * "boleh membuat promo tapi tidak bisa memasangnya di mana pun".
 */
const PERMISSION = "banner" as const

/**
 * Nilai mentah formulir promo. Tanggal tetap "YYYY-MM-DD" dari
 * `<input type="date">` — penentuan awal/penghujung hari terjadi di satu
 * tempat (`parseDateInput`), sama dengan jadwal banner.
 */
export type PromoValues = {
  title: string
  slug: string
  description: string
  terms: string
  isActive: boolean
  startsAt: string
  endsAt: string
  productIds: number[]
}

export type PromoActionResult =
  | { success: true; id: string }
  | { success: false; error: string }

/** Batas jumlah produk per promo — rem supaya halaman tetap ringan. */
const MAX_PRODUCTS = 200

const PromoSchema = z.object({
  // Panjangnya mengikuti kolom di prisma/schema.prisma. Tanpa batas di sini,
  // isian yang kepanjangan baru ditolak MariaDB sebagai galat mentah.
  title: z.string().trim().min(1, "Judul promo wajib diisi").max(255, "Judul terlalu panjang (maksimal 255 karakter)"),
  slug: z
    .string()
    .trim()
    .min(1, "Alamat halaman wajib diisi")
    .max(160, "Alamat halaman terlalu panjang (maksimal 160 karakter)")
    .regex(PROMO_SLUG_PATTERN, "Alamat hanya boleh huruf kecil, angka, dan tanda hubung (mis. laptop-sale-september)"),
  description: z.string().trim().max(5000, "Deskripsi terlalu panjang"),
  terms: z.string().trim().max(5000, "Syarat & ketentuan terlalu panjang"),
  isActive: z.boolean(),
  startsAt: z.string(),
  endsAt: z.string(),
  productIds: z
    .array(z.number().int().positive())
    .max(MAX_PRODUCTS, `Maksimal ${MAX_PRODUCTS} produk per promo`),
})

function readPromoInput(values: PromoValues): { ok: true; data: PromoInput } | { ok: false; error: string } {
  const parsed = PromoSchema.safeParse(values)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const startsAt = parseDateInput(parsed.data.startsAt, "start")
  const endsAt = parseDateInput(parsed.data.endsAt, "end")

  // Rentang terbalik membuat halaman langsung "berakhir" sebelum pernah
  // dimulai — sama dengan aturan di formulir kampanye.
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "Tanggal berakhir jatuh sebelum tanggal mulai." }
  }

  return {
    ok: true,
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      terms: parsed.data.terms || null,
      isActive: parsed.data.isActive,
      startsAt,
      endsAt,
      // Id ganda akan melanggar kunci utama `promo_products`; dibuang di sini,
      // urutan kemunculan pertama dipertahankan.
      productIds: [...new Set(parsed.data.productIds)],
    },
  }
}

function revalidatePromoPages(slugs: string[]) {
  revalidateTag(PROMOS_CACHE_TAG, "max")
  // Banner membaca slug promonya lewat relasi di `getActiveBanners`.
  revalidateTag(BANNERS_CACHE_TAG, "max")
  revalidatePath("/admin/banner")
  revalidatePath("/promo")
  for (const slug of slugs) revalidatePath(`/promo/${slug}`)
  revalidatePath("/")
}

function toError(error: unknown): PromoActionResult {
  if (error instanceof PromoSlugTakenError) return { success: false, error: error.message }
  throw error
}

export async function createPromo(values: PromoValues): Promise<PromoActionResult> {
  await requirePermission(PERMISSION, "edit")

  const input = readPromoInput(values)
  if (!input.ok) return { success: false, error: input.error }

  try {
    const { id } = await createPromoRow(input.data)
    revalidatePromoPages([input.data.slug])
    return { success: true, id }
  } catch (error) {
    return toError(error)
  }
}

/**
 * `previousSlug` ikut dibersihkan: mengganti alamat promo membuat halaman lama
 * harus berhenti tampil dari cache, bukan bertahan sampai kedaluwarsa.
 */
export async function updatePromo(
  id: string,
  previousSlug: string,
  values: PromoValues
): Promise<PromoActionResult> {
  await requirePermission(PERMISSION, "edit")
  if (!id) return { success: false, error: "Promo tidak ditemukan." }

  const input = readPromoInput(values)
  if (!input.ok) return { success: false, error: input.error }

  try {
    await updatePromoRow(id, input.data)
    revalidatePromoPages([previousSlug, input.data.slug])
    return { success: true, id }
  } catch (error) {
    return toError(error)
  }
}

export async function deletePromo(
  id: string,
  slug: string
): Promise<{ success: true } | { success: false; error: string }> {
  await requirePermission(PERMISSION, "edit")
  if (!id) return { success: false, error: "Promo tidak ditemukan." }

  await softDeletePromoRow(id)
  revalidatePromoPages([slug])
  return { success: true }
}

/** Pencarian untuk pemilih produk di formulir promo. */
export async function searchProductsForPromo(query: string): Promise<PromoPickerProduct[]> {
  await requirePermission(PERMISSION, "edit")
  if (typeof query !== "string") return []
  return searchPromoPickerProducts(query.slice(0, 100))
}
