import { notFound } from "next/navigation"

import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import {
  getPcPrebuildConfig,
  getPcPrebuildGames,
  type PcPrebuildPreset,
} from "@/lib/pc-prebuild/config"
import { getPrebuildPickerProducts } from "@/lib/pc-prebuild/products"

import { PresetEditor } from "./preset-editor"

export const metadata = {
  title: "Sunting paket — PC Prebuild Admin HNS",
}

/**
 * Editor satu paket.
 *
 * `id` bernilai **"baru"** untuk paket yang belum pernah disimpan. Sengaja
 * memakai rute yang sama, bukan `/pc-prebuild/baru` tersendiri: editornya
 * identik, dan dua rute berarti dua tempat yang harus diubah setiap kali
 * editornya bertambah bagian.
 */
export default async function PrebuildEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const baru = id === "baru"

  const [config, steps, games] = await Promise.all([
    getPcPrebuildConfig(),
    // Langkahnya menumpang konfigurasi PC Builder — tidak ada daftar langkah
    // kedua yang harus dijaga. Staff yang menambah step di /admin/pc-builder
    // otomatis dikenali di sini.
    getPcBuilderConfig(),
    getPcPrebuildGames(),
  ])

  const tersimpan = baru ? null : config.presets.find((p) => p.id === id)
  if (!baru && !tersimpan) notFound()

  const preset: PcPrebuildPreset = tersimpan ?? {
    // Id dibuat di SERVER, bukan saat menyimpan. Kalau ia dibuat saat menyimpan,
    // dua kali tekan "Simpan" pada paket baru menghasilkan dua paket.
    id: crypto.randomUUID(),
    name: "",
    summary: "",
    images: [],
    order: config.presets.length,
    slots: [],
  }

  // Nama produk yang sudah dipakai preset — tanpa ini pemilihnya tampil kosong
  // padahal datanya ada, karena preset cuma menyimpan id. Id INDUK saja sudah
  // cukup: variannya ikut terbawa di dalam produknya.
  const idInduk = preset.slots.flatMap((slot) =>
    slot.items.flatMap((item) => [item.productId, ...item.alternatives.map((a) => a.productId)])
  )
  const katalog = await getPrebuildPickerProducts(idInduk)

  return (
    <PresetEditor
      initialPreset={preset}
      isNew={baru}
      steps={[...steps].sort((a, b) => (a.order || 0) - (b.order || 0))}
      games={games}
      initialCatalog={[...katalog.values()]}
    />
  )
}
