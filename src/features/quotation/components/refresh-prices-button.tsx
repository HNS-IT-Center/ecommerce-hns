"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw, TriangleAlert } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatRupiah } from "@/lib/utils"

import { previewLatestPricesAction, refreshQuotationPricesAction } from "../actions"
import type { LatestPricePreview } from "@/lib/api/pc-build-quotes"

/**
 * Tombol "Gunakan Harga Terbaru" di halaman detail quotation.
 *
 * Untuk kasus yang paling sering terjadi pada rakitan mahal: penawaran dibuat,
 * pelanggan pamit berpikir, lalu muncul lagi tiga bulan kemudian tanpa pernah
 * membayar DP. Harga di dokumen itu sudah bukan harga hari ini, dan sebelum ada
 * tombol ini satu-satunya jalan menyegarkannya adalah memuat ulang seluruh
 * rakitan di Builder lalu menyimpannya sebagai revisi.
 *
 * Isi rakitan TIDAK berubah — hanya harganya yang dibaca ulang dari katalog, di
 * server, lewat jalur yang sama dengan revisi biasa. Hasilnya revisi baru
 * dengan riwayatnya, bukan penulisan diam-diam atas angka yang sudah dicetak.
 *
 * Dialognya menyebut ANGKA, bukan cuma "harga akan mengikuti katalog": yang
 * menekan tombol ini biasanya sedang berbicara dengan pelanggannya, dan ia
 * perlu tahu totalnya naik atau turun sebelum menjawab. Angka itu dihitung di
 * server (`previewLatestPricesAction`) — komponen ini tidak mengalikan atau
 * mengurangi apa pun, ia cuma memformat (CLAUDE.md §2.7).
 */
export function RefreshPricesButton({
  code,
  sudahDp,
}: {
  code: string
  /** Bukan penghalang — cuma menambah satu baris peringatan di dialognya. */
  sudahDp: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<LatestPricePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const bukaDialog = () => {
    setError(null)
    setPreview(null)
    setOpen(true)
    startTransition(async () => {
      setPreview(await previewLatestPricesAction(code))
    })
  }

  const konfirmasi = () =>
    new Promise<void>((resolve) => {
      setError(null)
      startTransition(async () => {
        const hasil = await refreshQuotationPricesAction(code)
        if (!hasil.ok) setError(hasil.error)
        else router.refresh()
        resolve()
      })
    })

  return (
    <>
      <button
        type="button"
        onClick={bukaDialog}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Gunakan Harga Terbaru
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 flex w-full items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Perbarui harga mengikuti katalog hari ini?"
        description={
          <>
            <span className="block font-mono font-semibold text-foreground">{code}</span>

            {/* Pratinjau masih dimuat, gagal dimuat, atau sudah siap. Ketiganya
                punya tampilannya sendiri — dialog yang menyembunyikan
                kegagalannya akan membuat orang menekan "Ya" tanpa tahu apa pun. */}
            {preview === null ? (
              <span className="mt-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Menghitung harga terbaru…
              </span>
            ) : preview.ok ? (
              <>
                <span className="mt-2 block">
                  Total sekarang: <strong>{formatRupiah(preview.totalSekarang)}</strong>
                  <br />
                  Total dengan harga terbaru: <strong>{formatRupiah(preview.totalBaru)}</strong>
                </span>
                <span className="mt-2 block">
                  {preview.selisih === 0 ? (
                    <>Tidak ada harga yang berubah — dokumen tetap akan naik ke revisi baru.</>
                  ) : (
                    <>
                      {preview.barisBerubah} komponen berubah harga, total{" "}
                      <strong>
                        {preview.selisih > 0 ? "naik" : "turun"} {formatRupiah(Math.abs(preview.selisih))}
                      </strong>
                      .
                    </>
                  )}
                </span>
              </>
            ) : (
              <span className="mt-2 block text-destructive">{preview.error}</span>
            )}

            <span className="mt-2 block">
              Isi rakitannya tidak berubah. Dokumen naik ke revisi berikutnya, dan angka lama
              tetap tersimpan di riwayat revisi.
            </span>

            {sudahDp && (
              <span className="mt-2 block font-semibold text-amber-600 dark:text-amber-500">
                Quotation ini sudah ditandai DP. Pastikan harga barunya memang sudah disepakati
                dengan pelanggan.
              </span>
            )}
          </>
        }
        confirmLabel="Ya, perbarui harga"
        onConfirm={konfirmasi}
      />
    </>
  )
}
