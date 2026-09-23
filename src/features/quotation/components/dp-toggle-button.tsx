"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, Loader2, TriangleAlert, Undo2 } from "lucide-react"

import { ConfirmDialog } from "@/components/ui/confirm-dialog"

import { setQuotationDpAction } from "../actions"

/**
 * Tombol "Tandai Sudah DP" / "Batalkan tanda DP" di halaman detail quotation.
 *
 * **Yang ditandai adalah kenyataan, bukan aturan.** Harga sudah terkunci sejak
 * quotation disimpan — `items` adalah snapshot dan tidak ada jalur yang
 * memutakhirkannya sendiri. Tanda ini tidak mengunci, tidak membuka, dan tidak
 * menghalangi apa pun: quotation ber-DP tetap bisa direvisi dan tetap bisa
 * ditandai terjual kasir. Gunanya memberi tahu semua orang yang membuka dokumen
 * ini bahwa pelanggannya sudah membayar di muka.
 *
 * Karena itu pembatalannya juga tidak dibuat berat: tidak butuh admin dan tidak
 * butuh alasan tertulis, cukup dialog supaya tidak terjadi karena salah tekan.
 * Bandingkan dengan pembatalan status Terjual, yang mengurangi angka penjualan
 * seseorang dan karena itu menuntut keduanya (docs/17 §8).
 */
export function DpToggleButton({ code, sudahDp }: { code: string; sudahDp: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const konfirmasi = () =>
    new Promise<void>((resolve) => {
      setError(null)
      startTransition(async () => {
        const hasil = await setQuotationDpAction({ code, dp: !sudahDp })
        if (!hasil.ok) setError(hasil.error)
        else router.refresh()
        resolve()
      })
    })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={
          sudahDp
            ? "inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-60"
            : "inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green/90 disabled:opacity-60"
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : sudahDp ? (
          <Undo2 className="h-4 w-4" />
        ) : (
          <BadgeCheck className="h-4 w-4" />
        )}
        {sudahDp ? "Batalkan tanda DP" : "Tandai Sudah DP"}
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
        title={sudahDp ? "Batalkan tanda DP pada quotation ini?" : "Tandai quotation ini sudah DP?"}
        description={
          <>
            <span className="block font-mono font-semibold text-foreground">{code}</span>
            <span className="mt-2 block">
              {sudahDp
                ? "Tanda DP akan hilang dari halaman ini, dari riwayat, dan dari layar kasir. Harga dan isi rakitannya tidak berubah."
                : "Tanda ini muncul di riwayat Anda, di pengawasan admin, di layar kasir, dan di tautan penawaran pelanggan."}
            </span>
            <span className="mt-2 block">
              Harga rakitan <strong>tidak terpengaruh</strong> — ia sudah terkunci sejak
              quotation diterbitkan.
            </span>
          </>
        }
        confirmLabel={sudahDp ? "Ya, batalkan tandanya" : "Ya, sudah DP"}
        destructive={sudahDp}
        onConfirm={konfirmasi}
      />
    </>
  )
}
