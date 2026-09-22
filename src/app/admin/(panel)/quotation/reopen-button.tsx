"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RotateCcw, TriangleAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"

import { reopenQuotationAction } from "./actions"

const MAX_ALASAN = 255

/**
 * Membatalkan status terjual, dengan alasan yang WAJIB diketik.
 *
 * Bukan `ConfirmDialog` biasa: dialog itu hanya menanyakan ya/tidak, sedangkan
 * di sini yang menahan salah tekan justru keharusan mengetik alasannya. Tombol
 * setuju tetap mati sampai alasannya terisi — sebuah jeda yang disengaja pada
 * tindakan yang mengurangi capaian orang lain.
 */
export function ReopenButton({
  code,
  ownerName,
  total,
}: {
  code: string
  ownerName: string | null
  total: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const bisaKirim = reason.trim().length >= 5 && !pending

  const kirim = () => {
    if (!bisaKirim) return
    setError(null)
    startTransition(async () => {
      const hasil = await reopenQuotationAction({ code, reason })
      if (!hasil.ok) {
        setError(hasil.error)
        return
      }
      setOpen(false)
      setReason("")
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Batalkan
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return
          if (!next) {
            setReason("")
            setError(null)
          }
          setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan status terjual?</DialogTitle>
            <DialogDescription>
              <span className="block font-mono font-semibold text-foreground">{code}</span>
              <span className="mt-1 block">
                Sales: <strong>{ownerName ?? "—"}</strong> · Total:{" "}
                <strong>{formatRupiah(total)}</strong>
              </span>
              <span className="mt-2 block">
                Quotation kembali berstatus <strong>Terbit</strong> dan{" "}
                <strong>{formatRupiah(total)}</strong> dikeluarkan dari rekap penjualan bulan
                ini. Pembatalan ini tercatat beserta nama Anda dan alasannya.
              </span>
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="alasanBatal">
              Alasan pembatalan <span className="text-destructive">*</span>
            </label>
            <textarea
              id="alasanBatal"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={MAX_ALASAN}
              placeholder="mis. salah tandai — yang deal quotation nomor lain"
              className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              Batal
            </Button>
            <Button
              onClick={kirim}
              disabled={!bisaKirim}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Batalkan Status Terjual
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
