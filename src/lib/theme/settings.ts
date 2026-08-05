/**
 * Lapisan data untuk pengaturan tema.
 *
 * Mengikuti konvensi `lib/api/banners.ts`: `revalidateTag`/`revalidatePath`
 * TIDAK dipanggil dari sini, melainkan dari lapisan action — supaya fungsi di
 * berkas ini tetap bisa dipakai dari script tanpa menyeret konteks request.
 */
import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { DEFAULT_THEME_ID, findPresetTheme } from "./presets"
import { themeToCss } from "./css"
import type { ThemeSettings } from "./types"

export const THEME_CACHE_TAG = "site-theme"
export const THEME_SETTING_KEY = "THEME_SETTINGS"

const DEFAULT_SETTINGS: ThemeSettings = {
  activeChromeThemeId: DEFAULT_THEME_ID,
  activeCardThemeId: DEFAULT_THEME_ID,
}

/**
 * Baca pengaturan tema, divalidasi field demi field.
 *
 * Sengaja tidak memakai cast langsung (`value as ThemeSettings`): isi kolomnya
 * JSON bebas, dan preset bisa saja dihapus dari kode setelah sempat dipilih
 * admin. Id yang tidak dikenali dikembalikan ke default, bukan diteruskan —
 * kalau tidak, `getActiveThemeCss` akan gagal menemukan temanya dan situs
 * kehilangan tema tanpa penjelasan.
 */
export async function getThemeSettings(): Promise<ThemeSettings> {
  const fetcher = unstable_cache(
    async () => {
      const setting = await getPrisma().setting.findUnique({
        where: { key: THEME_SETTING_KEY },
      })
      return setting?.value ?? null
    },
    ["site-theme-settings"],
    { revalidate: 300, tags: [THEME_CACHE_TAG] }
  )

  const value = (await fetcher()) as {
    activeChromeThemeId?: unknown
    activeCardThemeId?: unknown
  } | null

  if (!value) return DEFAULT_SETTINGS

  const resolve = (id: unknown): string =>
    typeof id === "string" && findPresetTheme(id) ? id : DEFAULT_THEME_ID

  return {
    activeChromeThemeId: resolve(value.activeChromeThemeId),
    activeCardThemeId: resolve(value.activeCardThemeId),
  }
}

/**
 * CSS bertema untuk disuntik di root layout.
 *
 * Mengembalikan string kosong kalau kedua tema "default", sehingga halaman
 * tanpa tema aktif tidak membawa elemen `<style>` sama sekali.
 *
 * Pembacaannya lewat `unstable_cache` dan tidak menyentuh `cookies()`/`headers()`,
 * jadi halaman storefront TETAP statis/ISR — ini syarat yang tidak boleh
 * dilanggar, karena ke-19 halaman itu tidak mendeklarasikan `dynamic`.
 */
export async function getActiveThemeCss(): Promise<string> {
  const settings = await getThemeSettings()

  const chrome = findPresetTheme(settings.activeChromeThemeId)
  const card = findPresetTheme(settings.activeCardThemeId)

  return [
    chrome ? themeToCss(chrome, "chrome") : "",
    card ? themeToCss(card, "card") : "",
  ]
    .filter(Boolean)
    .join("")
}
