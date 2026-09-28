"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Pemotong foto profil: bingkai LINGKARAN yang bisa digeser dan di-zoom.
 *
 * Ditulis sendiri, tanpa menambah pustaka. Yang dibutuhkan cuma satu bingkai
 * lingkaran, geser, dan zoom — tiga hal yang seluruhnya bisa dikerjakan
 * `<canvas>` dan pointer event. Menambah dependensi ke tech stack menuntut
 * persetujuan tersendiri (CLAUDE.md §4), dan itu harga yang tidak sepadan untuk
 * ~150 baris.
 *
 * Yang keluar dari sini adalah gambar **512×512 WebP dengan sudut transparan**:
 * lingkarannya benar-benar dipotong, bukan sekadar ditutupi CSS. Bedanya terasa
 * di tempat yang tidak ikut dirancang hari ini — daftar admin, kelak avatar di
 * PDF atau di halaman penawaran — yang tidak perlu tahu bahwa fotonya harus
 * dibulatkan sendiri.
 *
 * Seluruh hitungannya piksel tata letak, bukan harga, jadi tidak ada urusan
 * dengan CLAUDE.md §2.7.
 */

/** Sisi bingkai di layar. Dipatok supaya hitungan geser/zoom punya satu satuan. */
const VIEWPORT = 256

/** Sisi gambar hasil. 512 cukup untuk avatar di layar DPR 2 tanpa jadi berat. */
const OUTPUT = 512

const ZOOM_MIN = 1
const ZOOM_MAX = 4

type Props = {
  /** Object URL berkas yang baru dipilih. `null` = dialog tertutup. */
  src: string | null
  onCancel: () => void
  onDone: (file: File) => void | Promise<void>
  /** Menahan tombol selama unggahan berjalan di pemanggil. */
  pending?: boolean
}

export function AvatarCropper({ src, onCancel, onDone, pending = false }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  /**
   * Skala dasar = "cover": sisi terpendek gambar tepat memenuhi bingkai. Tanpa
   * itu, foto potret akan muncul dengan pita kosong di kiri-kanan lingkaran dan
   * orangnya harus men-zoom hanya untuk menutupinya.
   */
  const baseScale = natural ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1
  const scale = baseScale * zoom
  const lebar = natural ? natural.w * scale : 0
  const tinggi = natural ? natural.h * scale : 0

  /**
   * Geseran ditahan supaya gambar SELALU menutupi bingkai. Membiarkannya bebas
   * berarti seseorang bisa menyimpan avatar yang separuhnya kosong tanpa pernah
   * melihat bahwa itu yang ia simpan.
   */
  const clamp = useCallback(
    (x: number, y: number) => ({
      x: Math.min(0, Math.max(VIEWPORT - lebar, x)),
      y: Math.min(0, Math.max(VIEWPORT - tinggi, y)),
    }),
    [lebar, tinggi],
  )

  /**
   * Zoom dan penahan geseran berubah bersama, dalam satu penanganan kejadian.
   *
   * Bukan sebagai efek atas `zoom`: batas geser berubah KARENA orangnya menarik
   * slider, bukan karena sebuah nilai kebetulan berbeda dari render sebelumnya.
   * Menuliskannya sebagai efek juga memicu render berantai yang memang ditolak
   * `react-hooks/set-state-in-effect`.
   */
  function ubahZoom(nilai: number) {
    setZoom(nilai)
    if (!natural) return
    const w = natural.w * baseScale * nilai
    const h = natural.h * baseScale * nilai
    setOffset((lama) => ({
      x: Math.min(0, Math.max(VIEWPORT - w, lama.x)),
      y: Math.min(0, Math.max(VIEWPORT - h, lama.y)),
    }))
  }

  function saatGambarSiap(event: React.SyntheticEvent<HTMLImageElement>) {
    const el = event.currentTarget
    const w = el.naturalWidth
    const h = el.naturalHeight
    const s = Math.max(VIEWPORT / w, VIEWPORT / h)
    setNatural({ w, h })
    setZoom(1)
    // Mulai dari tengah — bagian foto yang paling mungkin berisi wajah.
    setOffset({ x: (VIEWPORT - w * s) / 2, y: (VIEWPORT - h * s) / 2 })
  }

  function mulaiGeser(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
  }

  function geser(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    setOffset(clamp(d.ox + (event.clientX - d.x), d.oy + (event.clientY - d.y)))
  }

  function selesaiGeser(event: React.PointerEvent<HTMLDivElement>) {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  async function potong() {
    const img = imgRef.current
    if (!img || !natural) return

    const canvas = document.createElement("canvas")
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Bingkai di layar dan kanvas keluaran sebangun, jadi semua koordinat cukup
    // dikalikan satu rasio yang sama.
    const rasio = OUTPUT / VIEWPORT

    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, offset.x * rasio, offset.y * rasio, lebar * rasio, tinggi * rasio)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92),
    )
    if (!blob) return

    await onDone(new File([blob], "foto-profil.webp", { type: "image/webp" }))
  }

  return (
    <Dialog open={src !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Atur Foto Profil</DialogTitle>
          <DialogDescription>
            Geser fotonya, lalu atur perbesaran. Yang tampak di dalam lingkaran itulah yang
            disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            onPointerDown={mulaiGeser}
            onPointerMove={geser}
            onPointerUp={selesaiGeser}
            onPointerCancel={selesaiGeser}
            style={{ width: VIEWPORT, height: VIEWPORT }}
            className="relative max-w-full cursor-grab touch-none overflow-hidden rounded-full border-2 border-dashed border-primary/40 bg-muted active:cursor-grabbing"
          >
            {src && (
              /* eslint-disable-next-line @next/next/no-img-element -- object URL
                 lokal berukuran alami; `next/image` tidak bisa mengoptimalkannya
                 dan justru menyembunyikan `naturalWidth/Height` yang jadi dasar
                 seluruh hitungan di sini. */
              <img
                ref={imgRef}
                src={src}
                alt=""
                onLoad={saatGambarSiap}
                draggable={false}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: lebar || undefined,
                  height: tinggi || undefined,
                  maxWidth: "none",
                }}
              />
            )}
          </div>

          <div className="flex w-full items-center gap-3">
            <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(e) => ubahZoom(Number(e.target.value))}
              aria-label="Perbesaran foto"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-input px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={potong}
            disabled={pending || !natural}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Mengunggah…" : "Pakai Foto Ini"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
