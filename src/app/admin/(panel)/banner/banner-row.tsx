"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronUp, Layers, Pencil, Trash2 } from "lucide-react"

import type { BannerLiveState } from "@/lib/utils/banner"
// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { BannerWithBatch } from "@/lib/api/banners"
import { BannerStateBadge } from "./banner-state-badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Kendali pengurutan untuk satu baris.
 *
 * `handle` sudah berisi tombol seret lengkap dengan pendengar dnd-kit — baris
 * ini tidak tahu-menahu soal pustaka seretnya, itu urusan `banner-list.tsx`.
 *
 * Tombol naik/turun BUKAN pelengkap yang bisa dihapus. Seret adalah gerakan
 * tikus dan tidak punya padanan setara lewat papan ketik maupun pembaca layar;
 * prinsip yang sama sudah ditulis di `kategori/category-tree-dnd.tsx`. Sejak
 * kolom "Urutan Tampil" dibuang dari formulir, dua tombol ini adalah satu-
 * satunya jalan mengurutkan tanpa tikus.
 */
export type ReorderControls = {
  handle: React.ReactNode
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  busy: boolean
}

type BannerRowProps = {
  banner: BannerWithBatch
  state: BannerLiveState
  heldByBatch: boolean
  /** Kampanye yang sedang menahannya, kalau ada. */
  gate: { name: string } | null
  onDelete: () => void
  reorder?: ReorderControls
  /** Diteruskan ke elemen terluar oleh pembungkus dnd. */
  innerRef?: (node: HTMLDivElement | null) => void
  style?: React.CSSProperties
  dragging?: boolean
  dropTarget?: boolean
}

export function BannerRow({
  banner,
  state,
  heldByBatch,
  gate,
  onDelete,
  reorder,
  innerRef,
  style,
  dragging = false,
  dropTarget = false,
}: BannerRowProps) {
  return (
    <div
      ref={innerRef}
      style={style}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 transition-shadow sm:flex-row sm:items-center",
        dragging && "opacity-60 shadow-lg",
        dropTarget && "ring-2 ring-primary"
      )}
    >
      {reorder && (
        <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:gap-0.5">
          {reorder.handle}
          <div className="flex gap-1 sm:flex-col sm:gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={reorder.onMoveUp}
              disabled={!reorder.canMoveUp || reorder.busy}
              aria-label={`Naikkan urutan banner ${banner.title}`}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={reorder.onMoveDown}
              disabled={!reorder.canMoveDown || reorder.busy}
              aria-label={`Turunkan urutan banner ${banner.title}`}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative flex h-16 w-full shrink-0 items-center overflow-hidden rounded-lg px-3 text-white sm:w-40",
          banner.bgClass
        )}
      >
        {banner.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL R2 dinamis */}
            <img
              src={banner.imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}
        <span className="relative z-10 line-clamp-2 text-[11px] font-bold leading-tight">
          {banner.title}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{banner.title}</span>
          <BannerStateBadge state={state} heldByBatch={heldByBatch} />
          {banner.batch && (
            <span
              className={cn(
                "inline-flex max-w-55 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                banner.batch.deletedAt
                  ? "bg-muted text-muted-foreground line-through"
                  : "bg-primary/10 text-primary"
              )}
              title={
                banner.batch.deletedAt
                  ? "Kampanye ini sudah dihapus — tinggal catatan, tidak lagi memengaruhi tayang."
                  : `Bagian dari kampanye ${banner.batch.name}`
              }
            >
              <Layers className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{banner.batch.name}</span>
            </span>
          )}
        </div>

        {banner.subtitle && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{banner.subtitle}</p>
        )}

        <p className="mt-1 text-[11px] text-muted-foreground">
          {formatDate(banner.startsAt)} → {formatDate(banner.endsAt)}
          {banner.ctaHref && ` · ${banner.ctaHref}`}
        </p>

        {heldByBatch && gate && (
          <p className="mt-1 text-[11px] text-warning">
            Setelan banner ini sudah benar, tapi kampanye <strong>{gate.name}</strong> sedang
            menahannya. Ubahnya di tab &quot;Batch Kampanye&quot;.
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/admin/banner/${banner.id}`} />}
          nativeButton={false}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          type="button"
          onClick={onDelete}
          aria-label={`Hapus banner ${banner.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
