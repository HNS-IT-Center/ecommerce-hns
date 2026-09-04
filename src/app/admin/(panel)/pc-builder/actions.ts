"use server"

import { revalidateTag } from "next/cache"
import { getPrisma } from "@/lib/prisma/client"
import { requirePermission } from "@/lib/auth"
import {
  PC_BUILDER_CACHE_TAG,
  PC_BUILDER_DISPLAY_KEY,
  PC_BUILDER_SETTING_KEY,
  type PcBuilderDisplayConfig,
  type PcBuilderStepConfig,
} from "@/lib/pc-builder/config"

/**
 * Tipe SENGAJA tidak di-re-export dari sini.
 *
 * Berkas ini bertanda `"use server"`, dan Turbopack memperlakukan SETIAP export
 * di dalamnya sebagai server action — termasuk `export type`. Build produksi
 * gagal dengan "Export PcBuilderStepConfig doesn't exist in target module"
 * karena tipe hilang saat kompilasi, menyisakan referensi action ke sesuatu
 * yang tidak ada di runtime. (`tsc --noEmit` TIDAK menangkap ini; hanya
 * `next build` yang menangkapnya.)
 *
 * Importlah tipenya langsung dari `@/lib/pc-builder/config`.
 */

/**
 * Segarkan pembaca konfigurasi PC Builder.
 *
 * SENGAJA memakai `revalidateTag`, BUKAN `revalidatePath("/build-pc")`.
 *
 * Versi lama memanggil `revalidatePath("/build-pc")`, dan itu bentrok dengan
 * `revalidatePath("/", "layout")` milik `applyTheme`: `/build-pc` memegang
 * entri invalidasi path-nya sendiri sehingga tidak ikut tersegarkan oleh
 * invalidasi layout, dan HTML lamanya tetap membawa `<style id="theme-vars">`
 * dari tema sebelumnya. Gejalanya: mengganti tema terlihat di seluruh situs
 * KECUALI di halaman builder, dan "kembali ke default" seolah tidak berpengaruh
 * di sana.
 *
 * Dengan tag, konfigurasi builder disegarkan tanpa menyentuh cache path — jadi
 * invalidasi layout milik tema kembali berlaku penuh atas `/build-pc`.
 */
function revalidatePcBuilder() {
  revalidateTag(PC_BUILDER_CACHE_TAG, "max")
}

export async function savePcBuilderConfig(steps: PcBuilderStepConfig[]) {
  await requirePermission("pc-builder", "edit")
  const prisma = getPrisma()

  // Ensure we are saving a pure JSON object, removing any unexpected types
  const safeSteps = JSON.parse(JSON.stringify(steps))

  await prisma.setting.upsert({
    where: { key: PC_BUILDER_SETTING_KEY },
    update: { value: safeSteps },
    create: { key: PC_BUILDER_SETTING_KEY, value: safeSteps },
  })

  revalidatePcBuilder()
  return { success: true }
}

export async function savePcBuilderDisplayConfig(config: PcBuilderDisplayConfig) {
  await requirePermission("pc-builder", "edit")
  const prisma = getPrisma()
  const value = { showItemPrices: Boolean(config.showItemPrices) }

  await prisma.setting.upsert({
    where: { key: PC_BUILDER_DISPLAY_KEY },
    update: { value },
    create: { key: PC_BUILDER_DISPLAY_KEY, value },
  })

  revalidatePcBuilder()
  return { success: true }
}

export async function getPcBuilderOptions() {
  const prisma = getPrisma()

  const [categories, attributes] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true, path: true },
      orderBy: { path: "asc" },
    }),
    prisma.attribute.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  ])

  return { categories, attributes }
}
