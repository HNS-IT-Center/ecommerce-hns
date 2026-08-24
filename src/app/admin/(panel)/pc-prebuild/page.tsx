import { fetchBuilderProducts } from "@/features/builder/actions"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { getPrebuildProducts } from "@/lib/pc-prebuild/resolve"
import type { ComboboxOption } from "@/components/ui/combobox"

import { PrebuildManager } from "./prebuild-manager"

export const metadata = {
  title: "PC Prebuild — Admin HNS",
}

export default async function PcPrebuildPage() {
  // Langkahnya menumpang konfigurasi PC Builder, bukan daftar kedua yang harus
  // dijaga sendiri. Kalau staff menambah step di /admin/pc-builder, editor di
  // sini otomatis mengenalinya.
  const [config, steps, games] = await Promise.all([
    getPcPrebuildConfig(),
    getPcBuilderConfig(),
    getPcPrebuildGames(),
  ])
  const sortedSteps = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0))

  // Saran awal per langkah, supaya dropdown pemilih produk tidak kosong saat
  // pertama dibuka. Sengaja hanya 20 per langkah: sisanya dicari saat staff
  // mengetik, lewat server action yang sama dengan yang dipakai wizard.
  const optionEntries = await Promise.all(
    sortedSteps.map(async (step) => {
      const { products } = await fetchBuilderProducts({
        categoryIds: step.categoryIds ?? [],
        requiredAttributeValueIds: [],
        limit: 20,
      })
      return [step.id, products.map((p) => ({ id: p.id, label: p.name }))] as const
    })
  )
  const initialOptions: Record<string, ComboboxOption[]> = Object.fromEntries(optionEntries)

  // Nama produk yang sudah terpakai di preset — tanpa ini, pemilihnya tampil
  // kosong padahal datanya ada, karena preset cuma menyimpan id.
  const katalog = await getPrebuildProducts(
    config.presets.flatMap((preset) =>
      preset.slots.flatMap((slot) => slot.options.map((option) => option.productId))
    )
  )
  const productNames: Record<number, string> = {}
  // Harga IKUT dikirim supaya staff tahu paket yang sedang ia rakit jatuhnya
  // berapa. Ini keterangan untuk layar admin saja — angkanya tidak pernah
  // tersimpan ke preset; setiap pembacaan berikutnya membacanya lagi dari
  // katalog (lihat lib/pc-prebuild/config.ts).
  const productPrices: Record<number, number> = {}
  for (const [id, produk] of katalog) {
    productNames[id] = produk.name
    productPrices[id] = produk.price
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">PC Prebuild</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Paket rakitan siap pakai yang dipakai pelanggan sebagai titik awal di PC Builder. Mereka
          tetap bisa mengubahnya sebelum memesan. Harga tidak disimpan di sini — selalu dibaca dari
          katalog.
        </p>
      </div>

      <PrebuildManager
        initialConfig={config}
        steps={sortedSteps}
        initialOptions={initialOptions}
        productNames={productNames}
        productPrices={productPrices}
        games={games}
      />
    </div>
  )
}
