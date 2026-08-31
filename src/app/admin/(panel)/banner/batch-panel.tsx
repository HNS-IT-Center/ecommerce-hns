"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, Layers, Pencil, Trash2 } from "lucide-react"

import { bannerLiveState } from "@/lib/utils/banner"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { BatchRow } from "@/lib/api/banner-batches"
import { deleteBannerBatch } from "./actions"
import { BannerStateBadge } from "./banner-state-badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToastManager } from "@/components/ui/toast"

function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function scheduleText(batch: BatchRow): string {
  if (!batch.startsAt && !batch.endsAt) return "Tanpa batas tanggal"
  return `${formatDate(batch.startsAt)} → ${formatDate(batch.endsAt)}`
}

type BatchPanelProps = {
  batches: BatchRow[]
  /** Membuka formulir sunting — dialognya dipegang `banner-manager.tsx`. */
  onEdit: (batch: BatchRow) => void
}

export function BatchPanel({ batches, onEdit }: BatchPanelProps) {
  const router = useRouter()
  const toastManager = useToastManager()

  const [pendingDelete, setPendingDelete] = React.useState<BatchRow | null>(null)

  async function confirmDelete() {
    if (!pendingDelete) return

    try {
      const result = await deleteBannerBatch(pendingDelete.id)
      if (!result.success) {
        toastManager.add({ title: "Gagal", description: result.error })
        return
      }
      router.refresh()
    } catch {
      toastManager.add({
        title: "Gagal",
        description: "Terjadi kesalahan tak terduga. Coba lagi.",
      })
    } finally {
      setPendingDelete(null)
    }
  }

  if (batches.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada kampanye. Kampanye berguna kalau satu promo terdiri dari beberapa banner —
        semuanya bisa dinyalakan dan dimatikan sekaligus.
      </p>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {batches.map((batch) => {
          const state = bannerLiveState(batch)

          return (
            <div
              key={batch.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-start"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Layers className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{batch.name}</span>
                  <BannerStateBadge state={state} variant="batch" />
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {scheduleText(batch)}
                </p>

                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {batch.bannerCount} banner
                  {batch.heldBannerCount > 0 && (
                    <span className="text-warning">
                      {" "}
                      · {batch.heldBannerCount} tertahan kampanye ini
                    </span>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(batch)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  type="button"
                  onClick={() => setPendingDelete(batch)}
                  aria-label={`Hapus kampanye ${batch.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        destructive
        confirmLabel="Hapus"
        title={`Hapus kampanye "${pendingDelete?.name}"?`}
        description={
          <>
            Banner anggotanya <strong>tidak ikut terhapus</strong>. Namanya tetap tercatat di
            tiap banner sebagai keterangan, tapi kampanye ini berhenti mengatur tayangnya.
            {pendingDelete && pendingDelete.heldBannerCount > 0 && (
              <>
                {" "}
                <strong>
                  {pendingDelete.heldBannerCount} banner sedang tersembunyi karena kampanye ini
                </strong>{" "}
                — begitu kampanyenya dihapus, banner itu kembali mengikuti setelannya sendiri
                dan bisa langsung tayang di beranda.
              </>
            )}
          </>
        }
        onConfirm={confirmDelete}
      />
    </>
  )
}
