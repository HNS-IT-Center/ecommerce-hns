import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PrebuildDeck } from "@/features/pc-prebuild/components/prebuild-deck"
import { toPrebuildView } from "@/features/pc-prebuild/lib/to-view"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"

export const metadata = {
  title: "PC Prebuild — HNS IT Center",
  description:
    "Paket PC rakitan yang sudah dipilihkan teknisi HNS. Bisa langsung dipesan, bisa juga diubah dulu sesuai kebutuhan.",
}

/**
 * Daftar paket rakitan siap pakai.
 *
 * Harga dan stok TIDAK tersimpan di preset — `resolvePrebuildPresets()` membaca
 * keduanya segar dari katalog setiap kali halaman ini dirender (CLAUDE.md §2.7,
 * docs/11-pc-prebuild.md §3). Yang sampai ke komponen sudah lewat
 * `toPrebuildView()`, jadi hanya analisis yang sudah ditayangkan staff dan belum
 * basi yang bisa terlihat pelanggan.
 */
export default async function PcPrebuildPage() {
  const config = await getPcPrebuildConfig()

  // Sakelar mati = rute ini tidak ada bagi pelanggan (docs/11-pc-prebuild.md §5).
  // Presetnya tetap tersimpan; mematikan bukan menghapus.
  if (!config.enabled) redirect("/build-pc")

  const [steps, games] = await Promise.all([getPcBuilderConfig(), getPcPrebuildGames()])
  const resolved = await resolvePrebuildPresets(config.presets, steps)
  const views = resolved.map((preset) => toPrebuildView(preset, steps))

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      {/* `min-h-dvh` ada di SINI juga, bukan cuma di pembungkus luar. Yang di
          luar hanya menjamin footer tidak naik ke tengah layar saat paketnya
          sedikit; yang di sini menjamin area isinya sendiri setinggi satu layar
          penuh. Konsekuensinya disengaja: halaman selalu bisa digulir sedikit
          melewati layar, sepanjang header + footer. */}
      <main className="min-h-dvh flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <header className="mb-8 max-w-2xl">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              Paket PC Siap Pakai
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
              Rakitan yang sudah disusun teknisi HNS — komponennya cocok satu sama lain dan siap
              dipesan. Geser kartu untuk melihat perkiraan performanya, atau buka paketnya kalau
              ingin menukar komponen dulu.
            </p>
          </header>

          <PrebuildDeck views={views} games={games} />
        </div>
      </main>
      <Footer />
    </div>
  )
}
