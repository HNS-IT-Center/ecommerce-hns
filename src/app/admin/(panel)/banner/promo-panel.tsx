import Link from "next/link"
import { CalendarClock, ExternalLink, Pencil, TicketPercent } from "lucide-react"

import { bannerLiveState } from "@/lib/utils/banner"
import { promoHref } from "@/lib/utils/promo"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { PromoRow } from "@/lib/api/promos"
import { BannerStateBadge } from "./banner-state-badge"
import { Button } from "@/components/ui/button"

function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function scheduleText(promo: PromoRow): string {
  if (!promo.startsAt && !promo.endsAt) return "Tanpa batas tanggal"
  return `${formatDate(promo.startsAt)} → ${formatDate(promo.endsAt)}`
}

/** Daftar halaman promo — tab ketiga di `/admin/banner`. */
export function PromoPanel({ promos }: { promos: PromoRow[] }) {
  if (promos.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada halaman promo. Buat satu, isi produknya, lalu pilih di formulir banner supaya
        banner itu membuka halamannya saat diklik.
      </p>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {promos.map((promo) => (
        <div
          key={promo.id}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-start"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-sale-red/10 text-sale-red">
            <TicketPercent className="h-5 w-5" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{promo.title}</span>
              <BannerStateBadge state={bannerLiveState(promo)} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {promoHref(promo.slug)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
              {scheduleText(promo)}
            </p>
            <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
              {promo.productCount} produk · {promo.bannerCount} banner
              {promo.bannerCount === 0 && <span className="text-warning"> · belum ditaut banner</span>}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/admin/banner/promo/${promo.id}`} />}
              nativeButton={false}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              render={<Link href={promoHref(promo.slug)} target="_blank" aria-label={`Buka halaman ${promo.title}`} />}
              nativeButton={false}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
