/**
 * Lapisan data untuk konfigurasi PC Builder.
 *
 * Mengikuti konvensi `lib/theme/settings.ts` dan `lib/api/banners.ts`:
 * `revalidateTag`/`revalidatePath` TIDAK dipanggil dari sini, melainkan dari
 * lapisan action — supaya fungsi di berkas ini tetap bisa dipakai dari script
 * tanpa menyeret konteks request.
 *
 * Dulu getter-getter ini tinggal di `app/admin/(panel)/pc-builder/actions.ts`
 * yang bertanda `"use server"`. Dua akibatnya:
 *
 * 1. Setiap export di berkas itu menjadi server action — termasuk yang cuma
 *    membaca. Halaman storefront yang butuh datanya jadi memanggil lewat jalur
 *    server action, bukan pembacaan biasa.
 * 2. Pembacaannya menembus langsung ke Prisma tanpa cache tag, sehingga
 *    satu-satunya cara menyegarkan `/build-pc` adalah `revalidatePath` —
 *    dan itulah yang bentrok dengan `revalidatePath("/", "layout")` milik tema
 *    (lihat catatan di `savePcBuilderConfig`).
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

export const PC_BUILDER_CACHE_TAG = "pc-builder-config"

export const PC_BUILDER_SETTING_KEY = "PC_BUILDER_CONFIG"
export const PC_BUILDER_DISPLAY_KEY = "PC_BUILDER_DISPLAY"

export type PcBuilderStepConfig = {
  id: string
  name: string
  order: number
  categoryIds: number[]
  dependSteps: string[]
  dependAttributes: number[]
  isRequired?: boolean
  allowMultiple?: boolean
}

export type PcBuilderDisplayConfig = {
  /** Tampilkan kolom Harga & Subtotal per item di PDF quotation. */
  showItemPrices: boolean
}

const DEFAULT_DISPLAY: PcBuilderDisplayConfig = { showItemPrices: true }

/**
 * Satu step dianggap sah hanya kalau `id` dan `name`-nya string.
 *
 * Kolomnya JSON bebas dan pernah diisi bentuk lain sebelum tipe ini stabil.
 * Baris yang tidak berbentuk step dibuang, bukan diteruskan: `DynamicBuilderView`
 * langsung membaca `step.id` untuk memetakan `selections`, jadi satu entri cacat
 * cukup untuk merusak seluruh halaman builder.
 */
function isStepConfig(value: unknown): value is PcBuilderStepConfig {
  if (typeof value !== "object" || value === null) return false
  const step = value as Record<string, unknown>
  return typeof step.id === "string" && typeof step.name === "string"
}

/**
 * Konfigurasi step PC Builder.
 *
 * Pembacaannya lewat `unstable_cache` dengan tag, jadi halaman `/build-pc`
 * TETAP statis/ISR dan bisa disegarkan lewat `revalidateTag` — tanpa perlu
 * `revalidatePath("/build-pc")` yang mengganggu invalidasi layout milik tema.
 */
export async function getPcBuilderConfig(): Promise<PcBuilderStepConfig[]> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: PC_BUILDER_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["pc-builder-config"],
    { revalidate: 300, tags: [PC_BUILDER_CACHE_TAG] }
  )

  const value = await fetcher()
  if (!Array.isArray(value)) return []

  return value.filter(isStepConfig)
}

/**
 * Disimpan terpisah dari PC_BUILDER_CONFIG (yang isinya array step) supaya
 * menyimpan pengaturan tampilan tidak berisiko menimpa konfigurasi step.
 */
export async function getPcBuilderDisplayConfig(): Promise<PcBuilderDisplayConfig> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: PC_BUILDER_DISPLAY_KEY },
      })
      return setting?.value ?? null
    },
    ["pc-builder-display-config"],
    { revalidate: 300, tags: [PC_BUILDER_CACHE_TAG] }
  )

  const value = (await fetcher()) as { showItemPrices?: unknown } | null
  if (!value) return DEFAULT_DISPLAY

  return {
    showItemPrices:
      typeof value.showItemPrices === "boolean"
        ? value.showItemPrices
        : DEFAULT_DISPLAY.showItemPrices,
  }
}
