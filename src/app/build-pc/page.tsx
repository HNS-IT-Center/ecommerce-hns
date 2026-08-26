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
  searchParams: Promise<{ preset?: string; pick?: string }>
}) {
  const [{ preset: presetId, pick }, stepsConfig, customer] = await Promise.all([
    searchParams,
    getPcBuilderConfig(),
    getCurrentCustomer(),
  ])

  let presetLoad: { name: string; selections: Record<string, BuilderSelection[]> } | null = null

  if (presetId) {
    const config = await getPcPrebuildConfig()
    const preset = config.enabled ? config.presets.find((p) => p.id === presetId) : undefined

    if (preset) {
      /**
       * Yang menentukan harga adalah VARIANNYA kalau ada, bukan induknya —
       * induk VARIABLE sering berharga nol. Karena baris varian juga sebuah
       * `Product`, ia diambil lewat pencarian id yang sama.
       */
      const idBerlaku = (ref: { productId: number; variationId?: number }) =>
        ref.variationId ?? ref.productId

      const products = await fetchBuilderProductsByIds(
        preset.slots.flatMap((slot) =>
          slot.items.flatMap((item) => [
            idBerlaku(item),
            ...item.alternatives.map(idBerlaku),
          ])
        )
      )
      const byId = new Map(products.map((product) => [product.id, product]))
      const stepAda = new Set(stepsConfig.map((step) => step.id))
      const selections: Record<string, BuilderSelection[]> = {}

      /**
       * `pick` membawa pilihan tukar sebagai `stepId:productId`, BUKAN indeks.
       *
       * Indeks akan berkhianat diam-diam: begitu staff mengurutkan ulang atau
       * menghapus satu pilihan, setiap tautan yang sudah tersebar lewat
       * WhatsApp menunjuk produk lain. Pelanggan membuka tautan "RAM 32GB"
       * minggu depan dan mendapat 16GB — tanpa error, tanpa ada yang tahu.
       *
       * Satu langkah kini bisa berisi BEBERAPA barang (dua NVMe berbeda),
       * masing-masing dengan pilihan tukarnya sendiri. Karena itu yang disimpan
       * per langkah adalah HIMPUNAN id yang diminta, bukan satu id — dan
       * pencocokannya dilakukan per barang. `productId` tetap unik di dalam satu
       * langkah (ditegakkan parser), jadi `stepId:productId` masih menunjuk
       * tepat satu pilihan.
       */
      const diminta = new Map<string, Set<number>>()
      for (const bagian of (pick ?? "").split(",")) {
        const [stepId, mentah] = bagian.split(":")
        const productId = Number(mentah)
        if (stepId && Number.isFinite(productId) && productId > 0) {
          const set = diminta.get(stepId) ?? new Set<number>()
          set.add(productId)
          diminta.set(stepId, set)
        }
      }

      for (const slot of preset.slots) {
        // Step yang sudah dihapus dari konfigurasi builder DILEWATI — bukan
        // menggagalkan pemuatan. Rakitan yang termuat sebagian masih berguna;
        // yang tidak berguna adalah halaman yang menolak terbuka karena satu
        // komponen berubah.
        if (!stepAda.has(slot.stepId)) continue

        const idStep = diminta.get(slot.stepId)

        for (const item of slot.items) {
          // Seluruh kandidat untuk SATU barang: dirinya sendiri lebih dulu
          // (itulah bawaannya), lalu pilihan tukarnya.
          const kandidat = [item, ...item.alternatives]

          // Yang diminta lewat URL dipakai HANYA kalau ia benar-benar salah satu
          // kandidat barang ini dan produknya masih ada. Kalau tidak, jatuh ke
          // bawaan — bukan dipaksakan masuk.
          const dariUrl = idStep
            ? kandidat.find((k) => idStep.has(k.productId) && byId.has(idBerlaku(k)))
            : undefined

          // Bawaan = kandidat pertama yang produknya masih ada. Stok kosong
          // TIDAK memindahkan bawaan — pelanggan bisa menukarnya di wizard.
          const terpakai = dariUrl ?? kandidat.find((k) => byId.has(idBerlaku(k)))
          const product = terpakai ? byId.get(idBerlaku(terpakai)) : undefined
          if (!terpakai || !product) continue

          selections[slot.stepId] = [
            ...(selections[slot.stepId] ?? []),
            { product, quantity: terpakai.quantity },
          ]
        }
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
