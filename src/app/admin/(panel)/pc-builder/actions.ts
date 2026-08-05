"use server"

import { revalidatePath } from "next/cache"
import { getPrisma } from "@/lib/prisma/client"
import { z } from "zod"

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

const PC_BUILDER_SETTING_KEY = "PC_BUILDER_CONFIG"

export async function getPcBuilderConfig(): Promise<PcBuilderStepConfig[]> {
  const prisma = getPrisma()
  const setting = await prisma.setting.findUnique({
    where: { key: PC_BUILDER_SETTING_KEY },
  })

  if (!setting || !setting.value) {
    return []
  }

  // Fallback to empty array if not properly typed
  try {
    return setting.value as unknown as PcBuilderStepConfig[]
  } catch (e) {
    return []
  }
}

export async function savePcBuilderConfig(steps: PcBuilderStepConfig[]) {
  try {
    const prisma = getPrisma()
    
    // Ensure we are saving a pure JSON object, removing any unexpected types
    const safeSteps = JSON.parse(JSON.stringify(steps))

    await prisma.setting.upsert({
      where: { key: PC_BUILDER_SETTING_KEY },
      update: { value: safeSteps },
      create: { key: PC_BUILDER_SETTING_KEY, value: safeSteps },
    })

    revalidatePath("/admin/pc-builder")
    revalidatePath("/build-pc")
    return { success: true }
  } catch (error) {
    console.error("Error saving PC Builder Config:", error)
    throw error
  }
}

const PC_BUILDER_DISPLAY_KEY = "PC_BUILDER_DISPLAY"

export type PcBuilderDisplayConfig = {
  /** Tampilkan kolom Harga & Subtotal per item di PDF quotation. */
  showItemPrices: boolean
}

const DEFAULT_DISPLAY: PcBuilderDisplayConfig = { showItemPrices: true }

/**
 * Disimpan terpisah dari PC_BUILDER_CONFIG (yang isinya array step) supaya
 * menyimpan pengaturan tampilan tidak berisiko menimpa konfigurasi step.
 */
export async function getPcBuilderDisplayConfig(): Promise<PcBuilderDisplayConfig> {
  const prisma = getPrisma()
  const setting = await prisma.setting.findUnique({
    where: { key: PC_BUILDER_DISPLAY_KEY },
  })

  if (!setting?.value) return DEFAULT_DISPLAY

  const value = setting.value as { showItemPrices?: unknown }
  return {
    showItemPrices:
      typeof value.showItemPrices === "boolean"
        ? value.showItemPrices
        : DEFAULT_DISPLAY.showItemPrices,
  }
}

export async function savePcBuilderDisplayConfig(config: PcBuilderDisplayConfig) {
  const prisma = getPrisma()
  const value = { showItemPrices: Boolean(config.showItemPrices) }

  await prisma.setting.upsert({
    where: { key: PC_BUILDER_DISPLAY_KEY },
    update: { value },
    create: { key: PC_BUILDER_DISPLAY_KEY, value },
  })

  revalidatePath("/admin/pc-builder")
  revalidatePath("/build-pc")
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
