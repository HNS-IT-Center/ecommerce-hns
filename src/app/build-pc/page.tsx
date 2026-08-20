import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { DynamicBuilderView } from "@/features/builder/components/dynamic-builder-view"
import { fetchBuilderProductsByIds } from "@/features/builder/actions"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"
import { getCurrentCustomer } from "@/lib/auth/customer"
import type { BuilderSelection } from "@/store/new-builder"

export const metadata = {
  title: "PC Builder Custom — HNS IT Center",
  description: "Rakit PC idaman Anda dengan mudah. Pilih komponen, cek estimasi harga, dan cetak hasilnya.",
}

/**
 * Rakit sendiri, atau berangkat dari paket PC Prebuild lewat `?preset=<id>`.
 *
 * Presetnya diselesaikan DI SERVER, bukan di klien: harga dan stok tiap
 * komponen harus datang dari katalog (CLAUDE.md §2.7), dan menyerahkannya ke
 * klien berarti membuka jalan bagi angka yang tidak bisa dipertanggungjawabkan.
 */
export default async function BuildPcPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>
}) {
  const [{ preset: presetId }, stepsConfig, customer] = await Promise.all([
    searchParams,
    getPcBuilderConfig(),
    getCurrentCustomer(),
  ])

  let presetLoad: { name: string; selections: Record<string, BuilderSelection[]> } | null = null

  if (presetId) {
    const config = await getPcPrebuildConfig()
    const preset = config.enabled ? config.presets.find((p) => p.id === presetId) : undefined

    if (preset) {
      const products = await fetchBuilderProductsByIds(
        preset.slots.flatMap((slot) => slot.options.map((option) => option.productId))
      )
      const byId = new Map(products.map((product) => [product.id, product]))
      const stepAda = new Set(stepsConfig.map((step) => step.id))
      const selections: Record<string, BuilderSelection[]> = {}

      for (const slot of preset.slots) {
        // Step yang sudah dihapus dari konfigurasi builder DILEWATI — bukan
        // menggagalkan pemuatan. Rakitan yang termuat sebagian masih berguna;
        // yang tidak berguna adalah halaman yang menolak terbuka karena satu
        // komponen berubah.
        if (!stepAda.has(slot.stepId)) continue

        // Bawaan = pilihan pertama yang produknya masih ada. Stok kosong TIDAK
        // memindahkan bawaan — pelanggan bisa menukarnya sendiri di wizard.
        const terpakai = slot.options.find((option) => byId.has(option.productId))
        const product = terpakai ? byId.get(terpakai.productId) : undefined
        if (!terpakai || !product) continue

        selections[slot.stepId] = [
          ...(selections[slot.stepId] ?? []),
          { product, quantity: terpakai.quantity },
        ]
      }

      if (Object.keys(selections).length > 0) {
        presetLoad = { name: preset.name, selections }
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="hidden md:block print:hidden">
        <Header />
      </div>
      <main className="flex-1 bg-muted/20 print:bg-white print:m-0 print:p-0">
        <div className="mx-auto px-4 py-8 md:px-6 md:py-12 print:max-w-none print:p-8">
          <DynamicBuilderView
            stepsConfig={stepsConfig}
            isLoggedIn={!!customer}
            presetLoad={presetLoad}
          />
        </div>
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  )
}
