"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"

import type { BuildPhoto } from "@/lib/api/ticketing-builds"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

type PhotoGroup = { key: string; label: string; photos: BuildPhoto[] }

/**
 * Foto rakitan per kelompok; klik untuk memperbesar.
 *
 * `<img>` biasa, bukan `next/image`: fotonya dilayani storage Ticketing yang
 * host-nya berbeda per lingkungan (MinIO lokal, storage produksi), sedangkan
 * `remotePatterns` dikunci saat build. Mengoptimasi lewat server Next juga
 * berarti setiap foto Ticketing diunduh ulang oleh Hostinger — beban tanpa
 * manfaat untuk halaman yang dibuka segelintir staff.
 */
export function BuildPhotoGallery({ groups }: { groups: PhotoGroup[] }) {
  const [active, setActive] = useState<BuildPhoto | null>(null)

  return (
    <>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <section key={group.key} className="rounded-2xl border border-border bg-card p-4 shadow-sm md:p-6">
            <h2 className="text-sm font-bold md:text-base">
              {group.label}{" "}
              <span className="font-normal text-muted-foreground">({group.photos.length})</span>
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {group.photos.map((photo, index) => (
                <li key={`${photo.url}-${index}`}>
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
              {/* eslint-disable-next-line @next/next/no-img-element -- host storage Ticketing berbeda per lingkungan; lihat komentar komponen */}
              <img
                src={active.url}
                alt={active.title ?? "Foto rakitan"}
                referrerPolicy="no-referrer"
                className="max-h-[75dvh] w-full rounded-lg bg-muted object-contain"
              />
              <a
                href={active.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 justify-self-start text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka ukuran asli{active.fileName ? ` · ${active.fileName}` : ""}
              </a>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
