import { redirect } from "next/navigation"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"

export const metadata = {
  title: "PC Prebuild — HNS IT Center",
  description:
    "Paket PC rakitan yang sudah dipilihkan teknisi HNS. Bisa langsung dipesan, bisa juga diubah dulu sesuai kebutuhan.",
}

/**
 * PLACEHOLDER — tampilan halaman ini sedang dirancang ulang dari nol (26 Agt 2026).
 *
 * Desain lama sengaja DIHAPUS, bukan dikomentari, supaya tidak ada yang
 * diam-diam menyalinnya kembali. Kalau perlu melihatnya lagi:
 * `git show f33f698:src/app/pc-prebuild/page.tsx`
 *
 * Lapis data TIDAK ikut dihapus dan siap dipakai desain baru:
 * - `getPcPrebuildConfig()`     konfigurasi paket (settings DB, kunci PC_PREBUILD_CONFIG)
 * - `getPcBuilderConfig()`      daftar langkah wizard
 * - `resolvePrebuildPresets()`  harga & stok dibaca segar dari katalog
 *
 * Aturan yang tetap mengikat saat merakit ulang UI-nya — rinciannya di
 * `docs/11-pc-prebuild.md`:
 * - Harga HANYA berasal dari katalog. Tidak ada perkalian, persentase, atau
 *   potongan yang dihitung di klien (CLAUDE.md §2.7).
 * - Tautan varian membawa `productId`, BUKAN indeks pilihan.
 * - Hanya `performancePublic` yang boleh tampil ke pelanggan — `performance`
 *   apa adanya masih berisi draf dan hasil basi.
 */
export default async function PcPrebuildPage() {
  const config = await getPcPrebuildConfig()

  // Sakelar mati = rute ini tidak ada bagi pelanggan (docs/11-pc-prebuild.md §5).
  // Dipertahankan meski halamannya masih kosong: mematikan bukan menghapus.
  if (!config.enabled) redirect("/build-pc")

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <p className="text-center text-sm text-muted-foreground">
          Halaman PC Prebuild sedang dirancang ulang.
        </p>
      </main>
      <Footer />
    </div>
  )
}
