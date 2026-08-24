import { Cpu, MonitorPlay } from "lucide-react"

import type { PrebuildPerformance } from "@/lib/pc-prebuild/performance"

/**
 * Keseimbangan prosesor dan kartu grafis.
 *
 * Dua batang, bukan satu batang dua warna. Satu batang membaca seolah keduanya
 * berbagi satu jatah 100% — padahal keduanya bisa sama-sama 90% (rakitan yang
 * memang seimbang dan terpakai penuh) atau sama-sama 40% (rakitan yang tertahan
 * hal lain). Dua batang menjaga angkanya tetap berarti sendiri-sendiri.
 *
 * Label keseimbangannya DITURUNKAN dari selisih dua angka itu — sama seperti
 * persentase diskon yang boleh dihitung karena ia keterangan atas dua angka
 * yang sudah ada, bukan sumber angka baru.
 */

/** Selisih di bawah ini praktis tidak terasa saat dipakai. */
const AMBANG_SEIMBANG = 12
const AMBANG_TIMPANG = 28

function keseimbangan(cpu: number, gpu: number): { label: string; nada: string } {
  const selisih = Math.abs(cpu - gpu)
  if (selisih <= AMBANG_SEIMBANG) return { label: "Seimbang", nada: "text-brand-green" }
  if (selisih <= AMBANG_TIMPANG) return { label: "Sedikit timpang", nada: "text-(--chart-3)" }
  return { label: "Timpang", nada: "text-sale-red" }
}

function Baris({
  ikon,
  nama,
  nilai,
}: {
  ikon: React.ReactNode
  nama: string
  nilai: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-muted-foreground">
          {ikon}
          {nama}
        </span>
        <span className="font-bold tabular-nums">{nilai}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${nilai}%` }} />
      </div>
    </div>
  )
}

export function BottleneckMeter({ performance }: { performance: PrebuildPerformance }) {
  const { cpu, gpu, verdict } = performance.bottleneck
  const status = keseimbangan(cpu, gpu)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Keseimbangan Komponen</h3>
        <span className={`text-xs font-bold ${status.nada}`}>{status.label}</span>
      </div>

      <div className="space-y-2.5">
        <Baris ikon={<Cpu className="h-3.5 w-3.5" />} nama="Processor" nilai={cpu} />
        <Baris ikon={<MonitorPlay className="h-3.5 w-3.5" />} nama="Graphics Card" nilai={gpu} />
      </div>

      {verdict && <p className="text-xs leading-relaxed text-muted-foreground">{verdict}</p>}
    </div>
  )
}
