import { Gamepad2, Info, Sparkles, TriangleAlert } from "lucide-react"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import type { PrebuildPerformance } from "@/lib/pc-prebuild/performance"

import { BottleneckMeter } from "./bottleneck-meter"
import { FpsGrid } from "./fps-grid"
import { ResolutionChip } from "./resolution-flag"
import { UpgradeList } from "./upgrade-list"
import { UseCaseChart } from "./use-case-chart"

/**
 * Panel performa lengkap — dipakai halaman paket untuk pelanggan DAN panel
 * admin sebagai pratinjau draf.
 *
 * Satu komponen untuk dua tempat, dan itu disengaja: staff yang menyunting draf
 * harus melihat persis yang akan dilihat pelanggan. Pratinjau yang digambar
 * ulang dengan markup sendiri akan berbeda pelan-pelan dari yang asli, dan
 * bedanya baru ketahuan setelah tayang.
 *
 * Tidak ada `"use client"` di sini: panelnya statis. Yang butuh klien hanyalah
 * grafik dan tooltip di dalamnya, dan keduanya sudah menandai dirinya sendiri.
 */

/** Semua estimasi FPS dibuat pada patokan yang sama — lihat prompt di endpoint AI. */
const PATOKAN_FPS = "1080p"

function formatTanggal(iso: string): string {
  if (!iso) return ""
  const tanggal = new Date(iso)
  if (Number.isNaN(tanggal.getTime())) return ""
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(tanggal)
}

export function PerformancePanel({
  performance,
  games,
  className = "",
}: {
  performance: PrebuildPerformance
  games: PrebuildGame[]
  className?: string
}) {
  const tanggal = formatTanggal(performance.generatedAt)
  const adaFps = performance.gaming.fps.length > 0

  return (
    <section className={`space-y-5 rounded-2xl border bg-card p-5 shadow-sm ${className}`}>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-bold">
            <Sparkles className="h-4 w-4 text-primary" />
            Estimasi Performa
          </h2>
          <ResolutionChip performance={performance} />
        </div>

        {performance.headline && (
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
            {performance.headline}
          </p>
        )}
      </div>

      {performance.useCases.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Paling Cocok Untuk</h3>
          <UseCaseChart performance={performance} />
        </div>
      )}

      {/* Peringatan "bukan untuk gaming" muncul SEBELUM angkanya, bukan sesudah.
          Pelanggan yang melihat deretan FPS lebih dulu sudah membentuk harapan
          sebelum sampai ke catatannya. */}
      {!performance.gaming.suitable && performance.gaming.note && (
        <p className="flex items-start gap-2 rounded-xl border border-(--chart-3)/30 bg-(--chart-3)/10 p-3 text-xs leading-relaxed text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--chart-3)" />
          {performance.gaming.note}
        </p>
      )}

      {adaFps && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <Gamepad2 className="h-4 w-4 text-primary" />
              Estimasi FPS
            </h3>
            <span className="text-[11px] font-semibold text-muted-foreground">
              patokan {PATOKAN_FPS}
            </span>
          </div>
          <FpsGrid entries={performance.gaming.fps} games={games} />
        </div>
      )}

      {/* Catatan gaming untuk paket yang MEMANG untuk gaming tetap ditampilkan,
          hanya tanpa nada peringatan. */}
      {performance.gaming.suitable && performance.gaming.note && (
        <p className="text-xs leading-relaxed text-muted-foreground">{performance.gaming.note}</p>
      )}

      <BottleneckMeter performance={performance} />

      <UpgradeList upgrades={performance.upgrades} />

      {/* Wajib ada, dan sengaja jadi bagian komponen — bukan sesuatu yang
          ditambahkan halaman pemanggil dan bisa lupa disertakan. Angka di atas
          adalah perkiraan, dan pelanggan yang membacanya sebagai janji akan
          menagihnya ke CS. */}
      <p className="flex items-start gap-2 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Perkiraan berdasarkan analisis komponen, bukan hasil pengujian unit ini. Angka
          sebenarnya bergantung pada setelan grafis, versi driver, dan pembaruan game.
          {tanggal && ` Dihitung ${tanggal}.`}
        </span>
      </p>
    </section>
  )
}
