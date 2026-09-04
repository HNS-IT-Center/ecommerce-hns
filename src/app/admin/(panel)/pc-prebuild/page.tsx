import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"
import { requirePageView } from "@/lib/auth"

import { PrebuildDeck } from "./_components/prebuild-deck"

export const metadata = {
  title: "PC Prebuild — Admin HNS",
}

/**
 * Deck paket rakitan siap pakai.
 *
 * Halaman ini SENGAJA hanya merangkum. Penyuntingan pindah ke halamannya
 * sendiri (`./[id]`) — panel lama menumpuk seluruh editor di dalam kartu
 * akordeon, dan editor performanya saja 646 baris yang harus dilipat ke dalam
 * kartu setinggi tiga baris.
 *
 * Harga dihitung di SERVER lewat `resolvePrebuildPresets`, bukan dikirim
 * mentah ke klien untuk dijumlahkan di sana. Angkanya keterangan untuk staff,
 * dan tetap tidak pernah tersimpan ke preset (CLAUDE.md §2.7).
 */
export default async function PcPrebuildAdminPage() {
  await requirePageView("pc-prebuild")
  const [config, steps, games] = await Promise.all([
    getPcPrebuildConfig(),
    // Langkahnya menumpang konfigurasi PC Builder, bukan daftar kedua yang
    // harus dijaga sendiri. Staff yang menambah step di /admin/pc-builder
    // otomatis dikenali di sini.
    getPcBuilderConfig(),
    getPcPrebuildGames(),
  ])

  const resolved = await resolvePrebuildPresets(config.presets, steps)

  const kartu = resolved.map((preset) => ({
    id: preset.id,
    name: preset.name,
    summary: preset.summary,
    cover: preset.images[0] ?? null,
    imageCount: preset.images.length,
    itemCount: preset.items.length,
    total: preset.total,
    missingCount: preset.missingCount,
    outOfStockCount: preset.outOfStockCount,
    orphanStepCount: preset.orphanStepCount,
    // Tiga keadaan analisis yang berbeda artinya, dan ketiganya perlu terlihat
    // dari deck tanpa membuka paketnya: belum pernah dihitung, sudah dihitung
    // tapi komponennya berubah, dan sudah tayang ke pelanggan.
    hasAnalysis: preset.performance !== null,
    analysisStale: preset.performanceStale,
    analysisPublished: preset.performance?.published === true,
  }))

  return (
    <PrebuildDeck
      presets={kartu}
      enabled={config.enabled}
      gameCount={games.length}
      stepCount={steps.length}
    />
  )
}
