"use client"

import { History } from "lucide-react"

import type { DashboardLogItem } from "@/lib/api/admin-dashboard"
import { PRICE_ACTIONS, actionBadgeClass, actionLabel, formatLogValue } from "@/lib/logs/actions"
import { cn } from "@/lib/utils"
import { loadRecentLogs } from "./actions"
import { formatDashboardDate } from "./format-date"
import { OverviewCard, OverviewEmpty, OverviewFooterLink } from "./overview-card"
import { useCardLoader } from "./use-card-loader"

/**
 * 20 aktivitas produk terakhir. Bawaannya perubahan harga — pertanyaan yang
 * paling sering ditanyakan orang yang membuka dashboard ("harga apa yang baru
 * berubah?") — dan bisa diganti ke semua aktivitas atau satu jenis aksi.
 */
export function RecentLogsCard({
  initial,
  availableActions,
}: {
  initial: DashboardLogItem[]
  availableActions: string[]
}) {
  const { param: filter, data: logs, error, isPending, update } = useCardLoader<string, DashboardLogItem[]>(
    "price",
    initial,
    loadRecentLogs
  )

  return (
    <OverviewCard
      id="overview-logs"
      tone="neutral"
      icon={History}
      title="Aktivitas terakhir"
      description="20 log produk terbaru"
      isPending={isPending}
      error={error}
      actions={
        <select
          value={filter}
          onChange={(event) => update(event.target.value)}
          aria-label="Jenis aktivitas"
          className="w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary sm:w-48"
        >
          <option value="price">Perubahan harga</option>
          <option value="all">Semua aktivitas</option>
          <optgroup label="Per jenis aksi">
            {availableActions.map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </optgroup>
        </select>
      }
    >
      {logs.length === 0 ? (
        <OverviewEmpty>Belum ada aktivitas untuk pilihan ini.</OverviewEmpty>
      ) : (
        <ol aria-label="Log produk terbaru" className="-mx-2 max-h-88 divide-y divide-border overflow-y-auto overscroll-contain px-2">
          {logs.map((log) => (
            <li key={log.id} className="flex min-w-0 flex-col gap-1 py-2.5">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <span
                  className={cn(
                    "truncate rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    actionBadgeClass(log.action)
                  )}
                >
                  {actionLabel(log.action)}
                </span>
                <time dateTime={new Date(log.createdAt).toISOString()} className="shrink-0 text-xs text-muted-foreground">
                  {formatDashboardDate(log.createdAt)}
                </time>
              </div>
              <p className="truncate text-sm font-medium" title={log.productName}>
                {log.productName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {log.userName} · <LogChange log={log} />
              </p>
            </li>
          ))}
        </ol>
      )}

      <OverviewFooterLink href={logsHref(filter)}>Buka halaman logs</OverviewFooterLink>
    </OverviewCard>
  )
}

/**
 * Ringkasan satu baris. Perubahan harga tampil sebagai "lama → baru" dalam
 * rupiah lewat formatter yang sama dengan halaman Logs; aksi lain cukup
 * menyebut field-nya, karena nilainya kerap berupa teks panjang atau JSON yang
 * tidak muat di satu baris kartu.
 */
function LogChange({ log }: { log: DashboardLogItem }) {
  const isPrice = log.action === "UPDATE_PRICE" || log.action === "SYNC_PRICE"

  if (!isPrice) {
    // Aksi seluruh-produk (impor, tambah, hapus) mencatat `all` sebagai field;
    // kalimat di nilai barunya jauh lebih berguna daripada kata "all".
    return <>{log.fieldAffected === "all" && log.newValue ? log.newValue : log.fieldAffected}</>
  }

  // Satu field harga menyimpan angka mentah tanpa menyebut harga yang mana;
  // `multiple` sudah membawa labelnya sendiri dari `formatLogValue`.
  const prefix = PRICE_FIELD_LABELS[log.fieldAffected]
  return (
    <>
      {prefix && `${prefix}: `}
      {formatLogValue(log.action, log.oldValue)} → {formatLogValue(log.action, log.newValue)}
    </>
  )
}

const PRICE_FIELD_LABELS: Record<string, string> = {
  regular_price: "Normal",
  sale_price: "Obral",
}

function logsHref(filter: string) {
  if (filter === "price") return "/admin/logs?tab=update-harga"
  if (filter === "all") return "/admin/logs?tab=produk"

  const tab = PRICE_ACTIONS.includes(filter) ? "update-harga" : "produk"
  return `/admin/logs?tab=${tab}&action=${encodeURIComponent(filter)}`
}
