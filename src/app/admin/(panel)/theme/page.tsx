import type { Metadata } from "next"

import { requireAuth } from "@/lib/auth"
import { getThemeSettings } from "@/lib/theme/settings"
import { ThemeEditor } from "./theme-editor"

export const metadata: Metadata = {
  title: "Tema",
}

export default async function AdminThemePage() {
  await requireAuth()

  const settings = await getThemeSettings()

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tema Tampilan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pilih nuansa musiman untuk halaman toko. Panel admin tidak ikut berubah.
        </p>
      </div>

      <ThemeEditor settings={settings} />
    </div>
  )
}
