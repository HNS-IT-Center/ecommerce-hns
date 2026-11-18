import { Suspense } from "react"
import { Wrench } from "lucide-react"

import type { BuildStatus } from "@/lib/api/ticketing-builds"
import { cn } from "@/lib/utils"
import { QuoteBadge } from "./quote-badge"

/**
 * Penanda "Sudah dirakit" dari Ticketing (docs/17 §22) — HANYA tampilan.
 *
 * Tidak mengubah status, closing, DP, atau rekap sales, dan tidak disimpan di
 * database ecommerce: tiket yang dibatalkan di Ticketing langsung menghilangkan
 * penandanya di pembukaan halaman berikutnya.
 *
 * `statuses` adalah promise yang dimulai halaman TANPA ditunggu. Komponen ini
 * menunggunya di dalam `<Suspense>`, jadi daftar quotation tampil seketika dan
 * penandanya menyusul — Ticketing yang lambat tidak pernah menahan halaman.
 * `getBuildStatuses` tidak pernah melempar; gagal = peta kosong = tanpa penanda.
 */
export function BuildStatusBadge({
  code,
  statuses,
  variant = "compact",
  className,
}: {
  code: string
  statuses: Promise<Map<string, BuildStatus>>
  variant?: "compact" | "detail"
  /** Jarak dsb. — dipasang di penanda itu sendiri, jadi tidak menyisakan ruang kosong saat tidak ada tiket. */
  className?: string
}) {
  return (
    <Suspense fallback={null}>
      <BuildStatusBadgeInner code={code} statuses={statuses} variant={variant} className={className} />
    </Suspense>
  )
}

async function BuildStatusBadgeInner({
  code,
  statuses,
  variant,
  className,
}: {
  code: string
  statuses: Promise<Map<string, BuildStatus>>
  variant: "compact" | "detail"
  className?: string
}) {
  const status = (await statuses).get(code.toUpperCase())
  if (!status) return null

  if (variant === "detail") {
    return (
      <div className={cn("mt-4 flex items-start gap-3 rounded-xl border border-foreground/15 bg-foreground/5 px-4 py-3 text-sm", className)}>
        <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-bold">Sudah dirakit</span>
          {" · tiket "}
          <span className="font-mono font-semibold">{status.ticketCode}</span>
          {status.label ? ` · ${status.label}` : ""}
          {status.store && <span className="block text-xs text-muted-foreground">{status.store}</span>}
        </p>
      </div>
    )
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      <QuoteBadge tone="dirakit">
        <Wrench className="h-3 w-3" />
        Sudah dirakit
      </QuoteBadge>
      <span className="text-[11px] text-muted-foreground">
        <span className="font-mono font-semibold text-foreground">{status.ticketCode}</span>
        {status.label ? ` · ${status.label}` : ""}
      </span>
    </span>
  )
}
