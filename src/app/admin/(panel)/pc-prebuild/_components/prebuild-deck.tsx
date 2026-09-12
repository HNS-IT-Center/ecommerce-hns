"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  Gamepad2,
  ImageOff,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formatRupiah } from "@/lib/utils"

import { deletePcPrebuildPreset, setPcPrebuildEnabled } from "../actions"

/**
 * Ringkasan satu paket — bentuknya dideklarasikan di sini, bukan diimpor dari
 * `page.tsx`. Komponen ini tidak butuh tahu seluruh bentuk preset; yang ia
 * butuhkan cuma yang muat di sebuah kartu.
 */
type KartuPreset = {
  id: string
  name: string
  summary: string
  cover: string | null
  imageCount: number
  itemCount: number
  total: number
  missingCount: number
  outOfStockCount: number
  orphanStepCount: number
  hasAnalysis: boolean
  analysisStale: boolean
  analysisPublished: boolean
}

type Props = {
  presets: KartuPreset[]
  enabled: boolean
  gameCount: number
  /** Nol berarti PC Builder belum punya langkah — paket tidak bisa disusun sama sekali. */
  stepCount: number
}

/** Kelas dasar kartu. Satu tempat, supaya tinggi & radiusnya tidak pelan-pelan berbeda. */
// `min-w-0` ikut di sini: kartu ini anak grid, dan anak grid bawaannya
// `min-width: auto` — nama paket panjang akan melebarkan kolomnya, bukan
// dipotong oleh `truncate` seperti yang diharapkan.
const KARTU =
  "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200"

export function PrebuildDeck({ presets, enabled, gameCount, stepCount }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [hapusId, setHapusId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const akanDihapus = presets.find((p) => p.id === hapusId) ?? null

  function ubahSakelar(nyala: boolean) {
    setError(null)
    startTransition(async () => {
      const hasil = await setPcPrebuildEnabled(nyala)
      if (!hasil.success) setError("Sakelar gagal disimpan.")
      router.refresh()
    })
  }

  async function hapus(id: string) {
    setError(null)
    const hasil = await deletePcPrebuildPreset(id)
    if (!hasil.success) {
      setError(hasil.error ?? "Paket gagal dihapus.")
      return
    }
    setHapusId(null)
    router.refresh()
  }

  return (
    <TooltipProvider>
      <div className="flex-1 space-y-6">
        {/* Kepala halaman. Di layar sempit sakelarnya turun ke bawah judul,
            bukan berdesakan di kanan sampai teksnya terpotong. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">PC Prebuild</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Paket rakitan siap pakai yang dipakai pelanggan sebagai titik awal di PC Builder.
              Harga tidak disimpan di sini — selalu dibaca dari katalog.
            </p>
          </div>

          <label className="flex shrink-0 items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <Switch
              checked={enabled}
              onCheckedChange={ubahSakelar}
              disabled={pending}
              aria-label="Tampilkan PC Prebuild ke pelanggan"
            />
            <span className="text-sm">
              <span className="block font-semibold leading-none">
                {enabled ? "Tayang" : "Tidak tayang"}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {enabled ? "Terlihat pelanggan" : "Paket tetap tersimpan"}
              </span>
            </span>
          </label>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-sale-red/30 bg-sale-red/5 px-4 py-3 text-sm text-sale-red">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {stepCount === 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              PC Builder belum punya satu langkah pun, jadi paket belum bisa disusun. Buat
              langkahnya dulu di{" "}
              <Link href="/admin/pc-builder" className="font-semibold underline">
                PC Builder
              </Link>
              .
            </span>
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {/* Kartu tambah SELALU di posisi pertama. Saat deck masih kosong ia
              satu-satunya yang ada, dan saat sudah penuh ia tetap di tempat yang
              sama — tombol yang berpindah setiap kali jumlah paket berubah
              memaksa mata mencarinya lagi. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/admin/pc-prebuild/baru"
                  aria-label="Tambahkan PC Prebuild"
                  className={`${KARTU} min-h-[19rem] items-center justify-center border-2 border-dashed bg-transparent shadow-none hover:border-brand-green hover:bg-brand-green/5 focus-visible:border-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40`}
                />
              }
            >
              <span className="flex flex-col items-center gap-3 px-6 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground transition-colors group-hover:border-brand-green group-hover:text-brand-green">
                  <Plus className="h-10 w-10" strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-brand-green">
                  Tambahkan PC Prebuild
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent>Tambahkan PC Prebuild</TooltipContent>
          </Tooltip>

          {presets.map((preset) => (
            <PresetCard key={preset.id} preset={preset} onDelete={() => setHapusId(preset.id)} />
          ))}

          {/* Daftar game punya kartunya sendiri, bukan tab kedua di halaman ini.
              Ia bukan paket — isinya satu daftar yang berlaku untuk SEMUA paket,
              dan menaruhnya sebagai tab membuatnya terlihat seperti bagian dari
              paket yang sedang dibuka. */}
          <Link
            href="/admin/pc-prebuild/games"
            className={`${KARTU} min-h-[19rem] justify-center border-dashed hover:border-brand-green/50 hover:shadow-md`}
          >
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                <Gamepad2 className="h-8 w-8" strokeWidth={1.5} />
              </span>
              <span>
                <span className="block text-base font-bold">Daftar Game</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {gameCount} game dipakai grid estimasi FPS
                </span>
              </span>
              <span className="text-xs font-semibold text-brand-green">Kelola daftar →</span>
            </div>
          </Link>
        </div>
      </div>

      <ConfirmDialog
        open={hapusId !== null}
        onOpenChange={(open) => !open && setHapusId(null)}
        title={`Hapus paket "${akanDihapus?.name ?? ""}"?`}
        description="Susunan komponen dan hasil analisisnya ikut hilang. Foto yang sudah diunggah tetap ada di penyimpanan. Kalau cuma ingin menyembunyikannya dari pelanggan, matikan sakelar Tayang — paketnya tetap tersimpan."
        confirmLabel="Hapus paket"
        destructive
        onConfirm={() => hapus(hapusId ?? "")}
      />
    </TooltipProvider>
  )
}

/** Satu kartu paket. Dipisah supaya `PrebuildDeck` tetap terbaca sebagai tata letak. */
function PresetCard({ preset, onDelete }: { preset: KartuPreset; onDelete: () => void }) {
  const bermasalah = preset.missingCount > 0 || preset.orphanStepCount > 0

  return (
    <div className={`${KARTU} hover:-translate-y-0.5 hover:shadow-lg`}>
      {/* Seluruh kartu menuju editor — tapi lewat SATU tautan yang menutupi
          area kartu, bukan dengan membungkus tombol hapus di dalam tautan.
          Tombol di dalam tautan menghasilkan markup yang tidak sah dan klik
          yang saling merebut. */}
      <Link
        href={`/admin/pc-prebuild/${encodeURIComponent(preset.id)}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
      >
        <span className="sr-only">Sunting {preset.name}</span>
      </Link>

      <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
        {preset.cover ? (
          <Image
            src={preset.cover}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          // Paket tanpa foto TIDAK menampilkan kotak abu-abu kosong. Ikon plus
          // keterangannya memberi tahu apa yang kurang, dan itu satu-satunya
          // hal yang berguna di ruang sebesar itu.
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-xs">Belum ada foto</span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {preset.analysisStale && <Chip tone="warning" icon={TriangleAlert} label="Perlu hitung ulang" />}
          {!preset.hasAnalysis && <Chip tone="muted" icon={Sparkles} label="Belum dianalisis" />}
          {preset.hasAnalysis && !preset.analysisStale && preset.analysisPublished && (
            <Chip tone="green" icon={Sparkles} label="Analisis tayang" />
          )}
          {preset.hasAnalysis && !preset.analysisStale && !preset.analysisPublished && (
            <Chip tone="muted" icon={Sparkles} label="Analisis draf" />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold">{preset.name}</h3>
          {preset.summary ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{preset.summary}</p>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground/70">Belum ada ringkasan</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            {preset.itemCount} komponen
          </span>
          {preset.imageCount > 0 && <span>{preset.imageCount} foto</span>}
          {preset.outOfStockCount > 0 && (
            <span className="text-warning">{preset.outOfStockCount} stok habis</span>
          )}
        </div>

        {bermasalah && (
          <p className="flex items-start gap-1.5 rounded-lg bg-sale-red/5 px-2.5 py-2 text-xs text-sale-red">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {preset.missingCount > 0 && `${preset.missingCount} komponen tidak ada di katalog`}
              {preset.missingCount > 0 && preset.orphanStepCount > 0 && " · "}
              {preset.orphanStepCount > 0 && `${preset.orphanStepCount} langkah sudah dihapus`}
            </span>
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t pt-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="truncate text-lg font-extrabold text-sale-red">
              {formatRupiah(preset.total)}
            </p>
          </div>

          {/* z-20 supaya tombol ini berada DI ATAS tautan yang menutupi kartu. */}
          <div className="relative z-20 flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href={`/admin/pc-prebuild/${encodeURIComponent(preset.id)}`}
                    aria-label={`Sunting ${preset.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:border-brand-green hover:text-brand-green"
                  />
                }
              >
                <Pencil className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Sunting paket</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Hapus ${preset.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:border-sale-red hover:bg-sale-red/5 hover:text-sale-red"
                  />
                }
              >
                <Trash2 className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent>Hapus paket</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

const NADA_CHIP = {
  green: "bg-brand-green/90 text-primary-foreground",
  warning: "bg-warning/90 text-white",
  muted: "bg-background/85 text-muted-foreground backdrop-blur-sm",
} as const

function Chip({
  tone,
  icon: Ikon,
  label,
}: {
  tone: keyof typeof NADA_CHIP
  icon: typeof Sparkles
  label: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm ${NADA_CHIP[tone]}`}
    >
      <Ikon className="h-3 w-3" />
      {label}
    </span>
  )
}
