"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import {
  BANNERS_CACHE_TAG,
  createBanner as createBannerRow,
  deleteBanner as deleteBannerRow,
  updateBanner as updateBannerRow,
  type BannerInput,
} from "@/lib/api/banners"

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
function readDate(formData: FormData, key: string, edge: "start" | "end"): Date | null {
  const value = String(formData.get(key) ?? "").trim()
  if (!value) return null
  return new Date(`${value}T${edge === "start" ? "00:00:00" : "23:59:59"}`)
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
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
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
