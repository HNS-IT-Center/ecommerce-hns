"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatRupiah } from "@/lib/utils"

import { markQuotationClosedAction } from "./actions"

/**
 * Tombol kasir "Tandai sebagai Closing".
 *
 * Dialog konfirmasinya bukan formalitas: tindakan ini tidak bisa dibatalkan
 * dari halaman ini, dan salah klik berarti quotation orang lain tercatat
 * sebagai penjualan. Karena itu dialognya menyebutkan kode, revisi, nama
 * pelanggan, dan totalnya — semua yang dibutuhkan kasir untuk memastikan ia
 * menutup dokumen yang benar, tanpa harus menutup dialog dulu untuk melihat.
 */
export function CloseQuotationButton({
  code,
  revision,
  customerName,
  total,
}: {
  code: string
  revision: number
  customerName: string | null
  total: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const konfirmasi = () =>
    new Promise<void>((resolve) => {
      setError(null)
      startTransition(async () => {
        const hasil = await markQuotationClosedAction({ code, expectedRevision: revision })
        if (!hasil.ok) setError(hasil.error)
        else router.refresh()
        resolve()
      })
    })

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-green px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-green/90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {pending ? "Menandai…" : "Tandai sebagai Closing"}
      </button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Tandai quotation ini sebagai TERJUAL?"
        description={
          <>
            <span className="block font-mono font-semibold text-foreground">
              {code}
              {revision > 1 && <span className="font-sans"> · Rev. {revision}</span>}
            </span>
            <span className="mt-1 block">
              Pelanggan: <strong>{customerName ?? "—"}</strong>
              <br />
              Total: <strong>{formatRupiah(total)}</strong>
            </span>
            <span className="mt-2 block">
              Tindakan ini <strong>tidak bisa dibatalkan dari halaman ini</strong> — hanya admin
              yang bisa membatalkannya, dan itu tercatat beserta alasannya.
            </span>
          </>
        }
        confirmLabel="Ya, tandai Terjual"
        onConfirm={konfirmasi}
      />
    </>
  )
}
