"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { requireAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma/client"
import { findPresetTheme, DEFAULT_THEME_ID } from "@/lib/theme/presets"
import { THEME_CACHE_TAG, THEME_SETTING_KEY, getThemeSettings } from "@/lib/theme/settings"

export type ThemeScope = "chrome" | "card"

/**
 * Terapkan sebuah preset ke salah satu ruang lingkup (chrome atau kartu produk).
 *
 * Id yang tidak dikenali ditolak, bukan disimpan apa adanya: kolomnya JSON bebas,
 * dan menyimpan id asing berarti situs kehilangan tema tanpa pesan kesalahan
 * apa pun ketika `getActiveThemeCss` gagal menemukannya.
 */
export async function applyTheme(scope: ThemeScope, themeId: string) {
  await requireAuth()

  const theme = findPresetTheme(themeId)
  if (!theme) {
    return { success: false as const, error: `Tema "${themeId}" tidak dikenali.` }
  }

  const current = await getThemeSettings()
  const next = {
    activeChromeThemeId:
      scope === "chrome" ? theme.id : current.activeChromeThemeId ?? DEFAULT_THEME_ID,
    activeCardThemeId:
      scope === "card" ? theme.id : current.activeCardThemeId ?? DEFAULT_THEME_ID,
  }

  await getPrisma().setting.upsert({
    where: { key: THEME_SETTING_KEY },
    update: { value: next },
    create: { key: THEME_SETTING_KEY, value: next },
  })

  revalidateTag(THEME_CACHE_TAG, "max")

  /**
   * Argumen "layout" WAJIB ada.
   *
   * CSS temanya disuntik di ROOT LAYOUT, jadi `revalidatePath("/")` saja hanya
   * menyegarkan render beranda — halaman lain yang sudah ter-prerender tetap
   * memegang CSS tema lama. Gejalanya menyesatkan: sebagian halaman bertema,
   * sebagian tidak, dan sulit ditelusuri.
   */
  revalidatePath("/", "layout")
  revalidatePath("/admin/theme")

  return { success: true as const }
}
