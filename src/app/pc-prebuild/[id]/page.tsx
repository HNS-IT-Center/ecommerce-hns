import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"

export const metadata = {
  title: "PC Prebuild — HNS IT Center",
  description: "Spesifikasi lengkap paket PC rakitan dari HNS IT Center Batam.",
}

type Props = { params: Promise<{ id: string }> }

/**
 * PLACEHOLDER — tampilan halaman ini sedang dirancang ulang dari nol (26 Agt 2026).
 *
 * SELURUH `src/features/pc-prebuild/` sudah dihapus — desain lamanya beserta
 * panel performanya. Kalau perlu melihatnya lagi:
 * `git show f33f698:src/features/pc-prebuild/components/`
 *
 * Yang TIDAK ikut dihapus dan siap dipakai desain baru:
 * - `resolvePrebuildPresets()`   spesifikasi + harga & stok segar dari katalog
 * - `getPcPrebuildGames()`       daftar game untuk grid FPS
 * - `prepareBuildWhatsApp()`     di `features/builder/actions-whatsapp.ts`
 * - `saveBuildAction()`          di `features/builder/actions-save.ts`
 *
 * DUA hal yang TIDAK boleh dirender di halaman ini saat dibangun nanti:
 * - `performance.bottleneck` — untuk panel admin saja (keputusan 26 Agt 2026).
 *   Bagi pembeli, "CPU 78 / GPU 91" bukan informasi yang bisa ditindaklanjuti.
 * - Saran upgrade — fiturnya dibuang seluruhnya, bukan disembunyikan.
 *
 * Dua jebakan yang sudah pernah menggigit saat merakit ulang tombolnya
 * (`docs/11-pc-prebuild.md` §7) — `tsc --noEmit` TIDAK menangkap keduanya,
 * hanya `next build`:
 * 1. JANGAN `import type` dari berkas bertanda `"use server"`. Turbopack
 *    memperlakukan setiap export di dalamnya sebagai server action. Deklarasikan
 *    ulang tipenya di pemanggil.
 * 2. JANGAN mengimpor NILAI dari `lib/pc-prebuild/config.ts` ke Client
 *    Component — `getPrisma()` ikut terseret ke bundle browser. Batas ada di
 *    `lib/pc-prebuild/limits.ts` justru karena itu.
 *
 * Dan aturan harga tetap berlaku: klien boleh MENJUMLAHKAN harga satuan yang
 * dikirim server, tapi tidak boleh menurunkan harga baru dari rumus
 * (CLAUDE.md §2.7).
 */
export default async function PrebuildDetailPage({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")

  // Id yang tidak dikenal tetap 404 walau halamannya masih kosong — supaya
  // tautan lama yang sudah tersebar tidak berujung ke halaman yang seolah ada.
  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

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

          <p className="py-24 text-center text-sm text-muted-foreground">
            Halaman detail paket sedang dirancang ulang.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
