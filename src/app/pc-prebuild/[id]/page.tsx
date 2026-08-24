import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PrebuildDetail } from "@/features/pc-prebuild/components/prebuild-detail"
import { PrebuildGallery } from "@/features/pc-prebuild/components/prebuild-gallery"
import { PerformancePanel } from "@/features/pc-prebuild/components/performance/performance-panel"
import { ResolutionFlag } from "@/features/pc-prebuild/components/performance/resolution-flag"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()
  const preset = config.presets.find((p) => p.id === id)

  if (!preset) return { title: "Paket tidak ditemukan — HNS IT Center" }

  return {
    title: `${preset.name} — PC Prebuild HNS IT Center`,
    description:
      preset.summary || `Spesifikasi lengkap paket ${preset.name} dari HNS IT Center Batam.`,
  }
}

/**
 * Detail satu paket: spesifikasi lengkapnya, pemilihan varian, dan dua jalan
 * keluar — pesan apa adanya, atau ubah dulu di PC Builder.
 *
 * Halaman ini hanya merakit datanya. Pemilihan varian butuh keadaan di klien,
 * jadi tampilannya ada di `PrebuildDetail` — tapi seluruh harga sudah selesai
 * dibaca dari katalog di sini, sebelum sampai ke browser.
 */
export default async function PrebuildDetailPage({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")

  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

  const [steps, games] = await Promise.all([getPcBuilderConfig(), getPcPrebuildGames()])
  const [resolved] = await resolvePrebuildPresets([preset], steps)

  // `performancePublic` sudah disaring di `resolve.ts`: draf dan analisis yang
  // komponennya sudah berubah bernilai null di sini. Halaman ini tidak perlu
  // tahu aturannya — lihat catatan di ResolvedPrebuildPreset.
  const performance = resolved.performancePublic

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <Link
            href="/pc-prebuild"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Semua paket
          </Link>

          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{resolved.name}</h1>
          {resolved.summary && (
            <p className="mt-2 max-w-2xl text-muted-foreground">{resolved.summary}</p>
          )}

          <PrebuildDetail
            presetId={resolved.id}
            namaPaket={resolved.name}
            gallery={
              <PrebuildGallery
                images={resolved.images}
                nama={resolved.name}
                badge={performance ? <ResolutionFlag performance={performance} /> : null}
              />
            }
            performance={
              performance ? <PerformancePanel performance={performance} games={games} /> : null
            }
            slots={resolved.slots.map((slot) => ({
              stepId: slot.stepId,
              stepName: slot.stepName,
              branching: slot.branching,
              defaultIndex: slot.defaultIndex,
              options: slot.options.map((option) => ({
                productId: option.productId,
                quantity: option.quantity,
                label: option.label,
                product: option.product,
              })),
            }))}
          />
        </div>
      </main>
      <Footer />
    </div>
  )
}
