"use client"

import * as React from "react"
import Link from "next/link"
import { Pencil, Trash2, Loader2 } from "lucide-react"
import type { PromoBanner } from "@prisma/client"

import { bannerLiveState, type BannerLiveState } from "@/lib/utils/banner"
import { deleteBanner } from "./actions"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

const STATE_BADGE: Record<BannerLiveState, { label: string; className: string }> = {
  live: { label: "Tayang", className: "bg-success/10 text-success" },
  scheduled: { label: "Terjadwal", className: "bg-info/10 text-info" },
  expired: { label: "Berakhir", className: "bg-muted text-muted-foreground" },
  inactive: { label: "Nonaktif", className: "bg-muted text-muted-foreground" },
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

export function BannerList({ banners }: { banners: PromoBanner[] }) {
  const [pendingDelete, setPendingDelete] = React.useState<PromoBanner | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  if (banners.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-input px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada banner. Klik &quot;Tambah Banner&quot; untuk membuat slide pertama di beranda.
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {banners.map((banner) => {
          const state = bannerLiveState(banner)
          const badge = STATE_BADGE[state]

          return (
            <div
              key={banner.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
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
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    urutan {banner.sortOrder}
                  </span>
                </div>
                {banner.subtitle && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {banner.subtitle}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatDate(banner.startsAt)} → {formatDate(banner.endsAt)}
                  {banner.ctaHref && ` · ${banner.ctaHref}`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" render={<Link href={`/admin/banner/${banner.id}`} />} nativeButton={false}>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="icon-sm"
                  type="button"
                  onClick={() => setPendingDelete(banner)}
                  aria-label={`Hapus banner ${banner.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus banner ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Banner <strong>{pendingDelete?.title}</strong> akan dihapus permanen dan langsung
              hilang dari beranda. Kalau cuma ingin menyembunyikannya sementara, matikan saklar
              Aktif lewat Edit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            {/* Server action dipanggil langsung, bukan lewat <form> bersarang.
                Tombol base-ui memasang `type="button"` secara bawaan, sehingga
                mengandalkan submit formulir di sini bergantung pada urutan
                penimpaan prop — kalau meleset, tombol Hapus diam saja tanpa
                galat apa pun. Memanggil aksinya langsung menghilangkan
                ketergantungan itu. */}
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!pendingDelete) return
                setIsDeleting(true)
                const formData = new FormData()
                formData.append("id", pendingDelete.id)
                await deleteBanner(formData)
                setIsDeleting(false)
                setPendingDelete(null)
              }}
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
