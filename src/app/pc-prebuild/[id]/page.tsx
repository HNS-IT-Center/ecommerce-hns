import { notFound, redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PrebuildDetail } from "@/features/pc-prebuild/components/prebuild-detail"
import { toPrebuildView } from "@/features/pc-prebuild/lib/to-view"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()
  const preset = config.enabled ? config.presets.find((p) => p.id === id) : undefined

  if (!preset) {
    return { title: "PC Prebuild — HNS IT Center" }
  }

  return {
    title: `${preset.name} — PC Prebuild HNS IT Center`,
    description:
      preset.summary ||
      "Spesifikasi lengkap paket PC rakitan dari HNS IT Center Batam, termasuk perkiraan performanya.",
  }
}

/**
 * Halaman satu paket rakitan.
 *
 * Seluruh perhitungan harga dikerjakan di server: `resolvePrebuildPresets()`
 * membaca harga & stok segar dari katalog, dan `toPrebuildView()` yang
 * memutuskan apa yang boleh menyeberang ke klien — termasuk menahan
 * `bottleneck` dan analisis yang masih draf atau sudah basi
 * (docs/11-pc-prebuild.md §9).
 */
export default async function PrebuildDetailPage({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")

  // Id yang tidak dikenal tetap 404 — supaya tautan lama yang sudah tersebar
  // lewat WhatsApp tidak berujung ke halaman yang seolah ada.
  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

  const [steps, games] = await Promise.all([getPcBuilderConfig(), getPcPrebuildGames()])
  const [resolved] = await resolvePrebuildPresets([preset], steps)
  const view = toPrebuildView(resolved, steps)

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex-1">
        <PrebuildDetail view={view} games={games} />
      </main>
      <Footer />
    </div>
  )
}
