"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Foto yang bisa di-zoom dan digeser, untuk dialog Dokumentasi Rakitan.
 *
 * Dirancang untuk kasir di PC (keputusan user 18 Nov 2026):
 * - scroll mouse → zoom ke titik kursor
 * - seret → geser (saat diperbesar)
 * - klik dua kali → 1× ⇄ 2,5× di titik yang diklik
 * - tombol − / + / reset, dan keyboard `+` `-` `0`
 *
 * Di HP tombol dan geser satu jari tetap jalan. Cubit dua jari sengaja belum
 * dibuat — kasir tidak memakainya.
 *
 * Ditulis sendiri, tanpa pustaka. Hitungannya: transform `translate(x,y)
 * scale(s)` dengan origin pojok kiri atas, dan foto `object-contain` di dalam
 * bingkai. Batas geser dihitung dari kotak FOTO sebenarnya (bukan bingkai),
 * jadi foto tidak bisa digeser sampai area kosong di sampingnya terlihat.
 *
 * Pasang dengan `key={url}` supaya zoom kembali ke 1× saat pindah foto.
 */

const MIN_SCALE = 1
const MAX_SCALE = 5
const STEP = 1.5
const DOUBLE_CLICK_SCALE = 2.5

type View = { scale: number; x: number; y: number }
const RESET: View = { scale: 1, x: 0, y: 0 }

export function ZoomablePhoto({
  src,
  alt,
  actions,
  className,
}: {
  src: string
  alt: string
  /** Tombol tambahan di baris kontrol (mis. Unduh), di sisi kanan. */
  actions?: ReactNode
  className?: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const naturalRef = useRef<{ w: number; h: number } | null>(null)
  const [view, setView] = useState<View>(RESET)
  const viewRef = useRef<View>(RESET)
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  /** Batasi skala & geseran supaya foto tetap menutupi bingkai (atau di tengah kalau lebih kecil). */
  const clamp = useCallback((next: View): View => {
    const frame = frameRef.current
    if (!frame) return next
    const W = frame.clientWidth
    const H = frame.clientHeight
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next.scale))

    // Kotak foto pada skala 1 di dalam bingkai (object-contain).
    const natural = naturalRef.current
    let cw = W
    let ch = H
    if (natural && natural.w > 0 && natural.h > 0) {
      const fit = Math.min(W / natural.w, H / natural.h)
      cw = natural.w * fit
      ch = natural.h * fit
    }
    const ox = (W - cw) / 2
    const oy = (H - ch) / 2

    const axis = (t: number, size: number, content: number, offset: number) => {
      const scaled = content * scale
      if (scaled <= size) return (size - scaled) / 2 - offset * scale
      return Math.min(-offset * scale, Math.max(size - scaled - offset * scale, t))
    }

    return { scale, x: axis(next.x, W, cw, ox), y: axis(next.y, H, ch, oy) }
  }, [])

  const apply = useCallback(
    (next: View) => {
      const clamped = clamp(next)
      viewRef.current = clamped
      setView(clamped)
    },
    [clamp],
  )

  /** Zoom ke `scale` dengan titik (px, py) — koordinat di dalam bingkai — tetap di tempatnya. */
  const zoomAt = useCallback(
    (scale: number, px: number, py: number) => {
      const current = viewRef.current
      const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
      const ratio = target / current.scale
      apply({ scale: target, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio })
    },
    [apply],
  )

  const zoomAtCenter = useCallback(
    (scale: number) => {
      const frame = frameRef.current
      if (!frame) return
      zoomAt(scale, frame.clientWidth / 2, frame.clientHeight / 2)
    },
    [zoomAt],
  )

  // Wheel lewat listener asli: React memasang onWheel sebagai pasif, jadi
  // preventDefault di sana tidak bisa menahan halaman ikut ter-scroll.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = frame.getBoundingClientRect()
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      zoomAt(viewRef.current.scale * Math.exp(-delta * 0.0015), event.clientX - rect.left, event.clientY - rect.top)
    }
    frame.addEventListener("wheel", onWheel, { passive: false })
    return () => frame.removeEventListener("wheel", onWheel)
  }, [zoomAt])

  // Keyboard selama dialog terbuka. Ctrl/Cmd + tetap milik zoom peramban.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === "+" || event.key === "=") zoomAtCenter(viewRef.current.scale * STEP)
      else if (event.key === "-" || event.key === "_") zoomAtCenter(viewRef.current.scale / STEP)
      else if (event.key === "0") apply(RESET)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [apply, zoomAtCenter])

  // Ukuran bingkai berubah (jendela diubah) → batas geser dihitung ulang.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => apply(viewRef.current))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [apply])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || viewRef.current.scale <= MIN_SCALE) return
    // Capture supaya seretan tetap jalan walau kursor keluar bingkai. Bisa
    // melempar (pointer sudah tidak aktif); seret di dalam bingkai tetap jalan.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // abaikan
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewRef.current.x,
      originY: viewRef.current.y,
    }
    setDragging(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    apply({
      scale: viewRef.current.scale,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    })
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
  }

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (viewRef.current.scale > MIN_SCALE) {
      apply(RESET)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    zoomAt(DOUBLE_CLICK_SCALE, event.clientX - rect.left, event.clientY - rect.top)
  }

  const zoomed = view.scale > MIN_SCALE + 0.001

  return (
    <div className={cn("grid gap-2", className)}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        className={cn(
          "relative h-[60dvh] w-full touch-none select-none overflow-hidden rounded-lg bg-muted sm:h-[70dvh]",
          zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- host storage Ticketing berbeda per lingkungan; lihat build-photo-gallery.tsx */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            naturalRef.current = { w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight }
            apply(viewRef.current)
          }}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          className={cn(
            "absolute left-0 top-0 h-full w-full origin-top-left object-contain",
            !dragging && "transition-transform duration-75 ease-out",
          )}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-lg border border-border bg-card">
          <ToolButton label="Perkecil" onClick={() => zoomAtCenter(viewRef.current.scale / STEP)} disabled={!zoomed}>
            <ZoomOut className="h-4 w-4" />
          </ToolButton>
          <span className="w-14 text-center text-xs font-semibold tabular-nums" aria-live="polite">
            {Math.round(view.scale * 100)}%
          </span>
          <ToolButton label="Perbesar" onClick={() => zoomAtCenter(viewRef.current.scale * STEP)} disabled={view.scale >= MAX_SCALE - 0.001}>
            <ZoomIn className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Kembalikan ukuran" onClick={() => apply(RESET)} disabled={!zoomed}>
            <RotateCcw className="h-4 w-4" />
          </ToolButton>
        </div>
        <p className="hidden text-xs text-muted-foreground lg:block">
          Scroll untuk zoom · seret untuk geser · klik dua kali untuk perbesar
        </p>
        {actions && <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">{actions}</div>}
      </div>
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
