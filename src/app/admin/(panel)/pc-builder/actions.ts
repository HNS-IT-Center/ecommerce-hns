"use server"

import { revalidatePath } from "next"
import { getPrisma } from "@/lib/prisma/client"
import { z } from "zod"

export type PcBuilderStepConfig = {
  id: string
  name: string
  order: number
  categoryIds: number[]
  dependSteps: string[]
  dependAttributes: number[]
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
  const prisma = getPrisma()
  
  await prisma.setting.upsert({
    where: { key: PC_BUILDER_SETTING_KEY },
    update: { value: steps as any },
    create: { key: PC_BUILDER_SETTING_KEY, value: steps as any },
  })

  revalidatePath("/admin/pc-builder")
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
