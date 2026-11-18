"use client"

import { useEffect, useRef, useState } from "react"
import { Download, ExternalLink, FolderDown, Loader2 } from "lucide-react"
import { useTopLoader } from "nextjs-toploader"

import type { NumberedBuildPhoto, NumberedPhotoGroup } from "@/lib/api/ticketing-build-downloads"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ZoomablePhoto } from "./zoomable-photo"

/**
 * Foto rakitan per kelompok; klik untuk membuka dialog dengan zoom & geser
 * (`zoomable-photo.tsx`), plus unduh per foto dan "Unduh semua" (ZIP).
 *
 * `<img>` biasa, bukan `next/image`: fotonya dilayani storage Ticketing yang
 * host-nya berbeda per lingkungan (MinIO lokal, storage produksi), sedangkan
 * `remotePatterns` dikunci saat build. Mengoptimasi lewat server Next juga
 * berarti setiap foto Ticketing diunduh ulang oleh Hostinger — beban tanpa
 * manfaat untuk halaman yang dibuka segelintir staff.
 *
 * Unduhan lewat `/api/dokumentasi-rakitan/...` (same-origin), bukan langsung ke
 * URL foto: `<a download>` diabaikan peramban untuk alamat domain lain. Tautan
 * biasa, bukan `fetch` + blob — peramban mengurus bilah unduhan sampai selesai,
 * termasuk di ponsel.
 */
export function BuildPhotoGallery({ code, groups }: { code: string; groups: NumberedPhotoGroup[] }) {
  const [active, setActive] = useState<NumberedBuildPhoto | null>(null)
  const topLoader = useTopLoader()
  const total = groups.reduce((sum, group) => sum + group.photos.length, 0)
  const base = `/api/dokumentasi-rakitan/${encodeURIComponent(code)}`
  const photoHref = (photo: NumberedBuildPhoto) => `${base}/foto/${photo.number}?k=${photo.key}`

  // Tautan unduhan tidak berpindah halaman; bilah progres atas jangan ikut menyala.
  const stopTopLoader = () => setTimeout(() => topLoader.done(), 0)

  return (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {total} foto dari Ticketing
        </p>
        <DownloadAllButton href={`${base}/zip`} total={total} onClick={stopTopLoader} />
      </div>

      <div className="mt-3 space-y-4">
        {groups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-sm font-bold md:text-base">
              {group.label}{" "}
              <span className="font-normal text-muted-foreground">({group.photos.length})</span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {group.photos.map((photo) => (
                <li key={`${photo.number}-${photo.key}`} className="relative">
                  <button
                    type="button"
                    onClick={() => setActive(photo)}
                    className="group block w-full overflow-hidden rounded-xl border border-border bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Perbesar foto ${photo.title ?? group.label}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- host storage Ticketing berbeda per lingkungan; lihat komentar komponen */}
                    <img
                      src={photo.url}
                      alt={photo.title ?? group.label}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    {photo.title && (
                      <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">{photo.title}</span>
                    )}
                  </button>
                  {/* Saudara tombol, bukan anaknya: tautan di dalam <button> tidak sah. Selalu tampil — ponsel tidak punya hover. */}
                  <a
                    href={photoHref(photo)}
                    download
                    onClick={stopTopLoader}
                    className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Unduh foto ${photo.title ?? group.label}`}
                    title="Unduh foto"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] gap-3 p-3 sm:max-w-4xl sm:p-4">
          {active && (
            <>
              <DialogTitle className="pr-8 text-sm break-words">
                {active.title ?? active.fileName ?? "Foto rakitan"}
              </DialogTitle>
              <ZoomablePhoto
                key={active.url}
                src={active.url}
                alt={active.title ?? "Foto rakitan"}
                actions={
                  <>
                    <a
                      href={photoHref(active)}
                      download
                      onClick={stopTopLoader}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold transition-colors hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Unduh
                    </a>
                    <a
                      href={active.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka ukuran asli
                    </a>
                  </>
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * ZIP disusun server dari storage Ticketing, jadi ada jeda sebelum bilah unduhan
 * peramban muncul. "Menyiapkan…" sebentar supaya klik tidak terasa diabaikan
 * dan tidak diklik berulang. Peramban tidak memberi tahu kapan unduhan mulai,
 * jadi tanda ini berdurasi tetap.
 */
function DownloadAllButton({ href, total, onClick }: { href: string; total: number; onClick: () => void }) {
  const [preparing, setPreparing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  return (
    <a
      href={href}
      download
      aria-disabled={preparing}
      onClick={(event) => {
        if (preparing) {
          event.preventDefault()
          return
        }
        onClick()
        setPreparing(true)
        timer.current = setTimeout(() => setPreparing(false), 4000)
      }}
      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 aria-disabled:opacity-70 sm:w-auto"
    >
      {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
      {preparing ? "Menyiapkan ZIP…" : `Unduh semua (${total} foto)`}
    </a>
  )
}
