import { Lock } from "lucide-react"

import type { BannerLiveState } from "@/lib/utils/banner"
import { cn } from "@/lib/utils"

const STATE_STYLE: Record<BannerLiveState, string> = {
  live: "bg-success/10 text-success",
  scheduled: "bg-info/10 text-info",
  expired: "bg-muted text-muted-foreground",
  inactive: "bg-muted text-muted-foreground",
}

/**
 * Hanya label "live" yang berbeda antara keduanya. Banner "Tayang" karena ia
 * memang muncul di beranda; kampanye "Aktif" karena ia tidak menampilkan
 * apa-apa sendiri — ia cuma membuka gerbang bagi anggotanya.
 */
const STATE_LABEL: Record<"banner" | "batch", Record<BannerLiveState, string>> = {
  banner: { live: "Tayang", scheduled: "Terjadwal", expired: "Berakhir", inactive: "Nonaktif" },
  batch: { live: "Aktif", scheduled: "Terjadwal", expired: "Berakhir", inactive: "Nonaktif" },
}

type BannerStateBadgeProps = {
  state: BannerLiveState
  /** `true` kalau yang menahan tayang adalah kampanye induknya. */
  heldByBatch?: boolean
  variant?: "banner" | "batch"
  className?: string
}

/**
 * Lencana status tayang, dipakai daftar banner maupun daftar kampanye.
 *
 * Gembok muncul saat status itu datang dari kampanye induk, bukan dari setelan
 * bannernya sendiri — supaya staff tidak membongkar banner yang sebenarnya
 * sudah benar.
 */
export function BannerStateBadge({
  state,
  heldByBatch = false,
  variant = "banner",
  className,
}: BannerStateBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        STATE_STYLE[state],
        className
      )}
      title={heldByBatch ? "Ditahan oleh kampanye penaungnya" : undefined}
    >
      {heldByBatch && <Lock className="h-2.5 w-2.5" aria-hidden="true" />}
      {STATE_LABEL[variant][state]}
    </span>
  )
}
