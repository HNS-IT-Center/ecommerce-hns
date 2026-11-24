"use client"

import * as React from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { AlertTriangle, ArrowDown, ArrowUp, GripVertical, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { STEP_KIND_LABELS } from "./step-labels"

/**
 * Card RINGKAS satu step di admin PC Builder — hanya teks, tanpa daftar.
 *
 * Dulu setiap kartu memuat seluruh daftar kategori & atribut sebagai checkbox
 * (ratusan baris per step, dikali jumlah step), dibungkus animasi framer-motion
 * dan `backdrop-blur`. Itulah yang membuat halamannya berat. Sekarang daftar
 * itu hanya dirender di panel edit (`step-edit-sheet.tsx`), untuk satu step
 * yang sedang dibuka.
 */
export interface StepCardProps {
  step: PcBuilderStepConfig
  index: number
  total: number
  /** Ringkasan yang sudah dihitung induknya — card tidak menelusuri data apa pun. */
  categoriesText: string
  compatText: string
  rulesText: string
  /** Aturan step LAIN yang bisa membuat step ini wajib. */
  inbound: string[]
  onEdit: () => void
  onMove: (direction: -1 | 1) => void
  /** Sasaran jatuhan sedang dilewati seretan. */
  dropTarget: boolean
}

export function StepCard({
  step,
  index,
  total,
  categoriesText,
  compatText,
  rulesText,
  inbound,
  onEdit,
  onMove,
  dropTarget,
}: StepCardProps) {
  // Dibongkar langsung — pola `banner/banner-list.tsx`: aturan lint React
  // menganggap akses properti pada hasil kait ini sebagai membaca ref.
  const {
    attributes,
    listeners,
    transform,
    isDragging,
    setNodeRef: setDragRef,
    setActivatorNodeRef,
  } = useDraggable({ id: step.id })
  const { setNodeRef: setDropRef } = useDroppable({ id: step.id })

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node)
      setDropRef(node)
    },
    [setDragRef, setDropRef]
  )

  const style: React.CSSProperties | undefined = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, position: "relative", zIndex: 20 }
    : undefined

  const name = step.name.trim()
  const kindLabel = step.kind ? STEP_KIND_LABELS[step.kind] : "Jenis belum diatur"
  const noCategories = (step.categoryIds ?? []).length === 0

  return (
    <div
      ref={setRefs}
      style={style}
      className={`flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow ${
        isDragging ? "shadow-xl ring-2 ring-primary/40" : "shadow-sm"
      } ${dropTarget && !isDragging ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
    >
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label={`Seret untuk mengurutkan step ${name || "tanpa nama"}`}
          className="hidden h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing md:flex"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-base font-bold ${name ? "" : "italic text-muted-foreground"}`}>
            {name || "Tanpa nama"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {kindLabel}
            {step.allowMultiple ? " · boleh banyak" : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
            step.isRequired
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {step.isRequired ? "Wajib" : "Opsional"}
        </span>
      </div>

      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 px-3.5 pb-3 text-[13px]">
        <dt className="text-muted-foreground">Kategori</dt>
        <dd className="truncate" title={categoriesText}>{categoriesText}</dd>
        <dt className="text-muted-foreground">Cocokkan</dt>
        <dd className="truncate" title={compatText}>{compatText}</dd>
        <dt className="text-muted-foreground">Aturan</dt>
        <dd className="truncate" title={rulesText}>{rulesText}</dd>
      </dl>

      {(noCategories || inbound.length > 0) && (
        <div className="space-y-1.5 px-3.5 pb-3">
          {noCategories && (
            <Note>Belum ada kategori — di /build-pc step ini menampilkan SEMUA produk.</Note>
          )}
          {inbound.map((text) => (
            <Note key={text}>{text}</Note>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2 border-t border-border bg-muted/30 px-3 py-2.5">
        <Button type="button" variant="outline" onClick={onEdit} className="h-10 flex-1 gap-1.5 font-semibold">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Pindahkan ${name || "step"} ke atas`}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`Pindahkan ${name || "step"} ke bawah`}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
