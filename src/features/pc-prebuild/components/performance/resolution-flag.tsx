import { Gauge } from "lucide-react"

import { FoldedBadge } from "@/components/ui/folded-badge"
import { PREBUILD_RESOLUTION_TIERS, type PrebuildPerformance } from "@/lib/pc-prebuild/performance"

/**
 * Penanda kelas performa di atas foto paket — sejajar dengan flag diskon di
 * kartu produk, dan sengaja memakai komponen pita yang sama supaya keduanya
 * terbaca sebagai satu bahasa visual, bukan dua gaya badge yang kebetulan
 * bertetangga.
 *
 * WARNANYA TIDAK BERTINGKAT. Sempat terpikir memberi tiap tingkatan warnanya
 * sendiri (hijau 720p, emas 4K), tapi itu menuntut satu skala warna baru yang
 * tidak ada di palet project dan tidak bisa ditimpa Theme Editor. Yang
 * membedakan tingkatan cukup teksnya; satu-satunya pengecualian `office`, yang
 * memang bukan kelas gaming dan tidak seharusnya memakai warna aksi.
 */

const TIER_LABELS = new Map(PREBUILD_RESOLUTION_TIERS.map((t) => [t.id, t.label]))

export function ResolutionFlag({ performance }: { performance: PrebuildPerformance }) {
  const label = TIER_LABELS.get(performance.resolution.tier) ?? performance.resolution.tier
  const office = performance.resolution.tier === "office"

  return (
    <FoldedBadge
      colorClass={office ? "bg-(--background-600)" : "bg-primary"}
      foldColorClass={office ? "bg-(--background-800)" : "bg-(--primary-700)"}
      icon={<Gauge className="h-3 w-3" />}
    >
      {label}
    </FoldedBadge>
  )
}

/**
 * Versi sebaris untuk di dalam panel — tanpa lipatan, karena ia tidak menempel
 * di sudut gambar melainkan duduk di antara teks.
 */
export function ResolutionChip({ performance }: { performance: PrebuildPerformance }) {
  const label = TIER_LABELS.get(performance.resolution.tier) ?? performance.resolution.tier
  const office = performance.resolution.tier === "office"

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
        office ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
      }`}
    >
      <Gauge className="h-3.5 w-3.5" />
      {label}
      {!office && <span className="font-semibold opacity-70">· {performance.resolution.quality}</span>}
    </span>
  )
}
