"use client"

import { useState } from "react"
import { Loader2, TriangleAlert } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  MAX_CUSTOMER_NAME,
  MAX_CUSTOMER_PHONE,
  MAX_INTERNAL_NOTE,
  TIDAK_OPER,
} from "../quotation-constants"

export type SalesOption = { id: string; displayName: string }

export type QuotationFormValues = {
  customerName: string
  customerPhone: string
  internalNote: string
  salesUserId?: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * `"sales"` — pemiliknya dirinya sendiri, tanpa pilihan operan.
   * `"cs"`    — wajib memilih Sales tujuan atau "Tidak oper".
   */
  mode: "sales" | "cs"
  salesOptions: SalesOption[]
  onSubmit: (values: QuotationFormValues) => Promise<{ ok: boolean; error?: string }>
}

/**
 * Dialog "Terbitkan Quotation" untuk staff.
 *
 * Pengunjung dan pelanggan biasa tidak pernah melihatnya — tombol Print mereka
 * langsung menerbitkan dokumen anonim, seperti sebelumnya.
 *
 * Yang dikirim dari sini HANYA identitas pelanggan dan pilihan operan. Harga
 * tidak pernah lewat klien (CLAUDE.md §2.7), dan siapa pemilik quotation
 * diputuskan ulang di server dari izin — pilihan di bawah cuma menentukan apa
 * yang terlihat.
 */
export function IssueQuotationDialog({
  open,
  onOpenChange,
  mode,
  salesOptions,
  onSubmit,
}: Props) {
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [internalNote, setInternalNote] = useState("")
  /**
   * Sengaja TANPA nilai bawaan untuk CS: mengoper ke seseorang dan menyimpan
   * atas nama sendiri adalah dua keputusan berbeda, dan salah satunya tidak
   * boleh terjadi hanya karena CS menekan Terbitkan tanpa melihat.
   */
  const [salesUserId, setSalesUserId] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const namaValid = customerName.trim().length >= 2
  const operanValid = mode === "sales" || salesUserId.length > 0
  const bisaKirim = namaValid && operanValid && !submitting

  const reset = () => {
    setCustomerName("")
    setCustomerPhone("")
    setInternalNote("")
    setSalesUserId("")
    setError(null)
  }

  const handleSubmit = async () => {
    if (!bisaKirim) return
    setSubmitting(true)
    setError(null)
    try {
      const hasil = await onSubmit({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        internalNote: internalNote.trim(),
        ...(mode === "cs" ? { salesUserId } : {}),
      })
      if (!hasil.ok) {
        setError(hasil.error ?? "Gagal menerbitkan quotation.")
        return
      }
      reset()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Terbitkan Quotation</DialogTitle>
          <DialogDescription>
            Quotation akan mendapat nomor urut dan tersimpan di riwayat Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
            <label className="mb-1 block text-sm font-semibold" htmlFor="quotationCustomerName">
              Nama Pelanggan <span className="text-destructive">*</span>
            </label>
            <Input
              id="quotationCustomerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              maxLength={MAX_CUSTOMER_NAME}
              placeholder="mis. Budi Santoso"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="quotationCustomerPhone">
              Nomor HP <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <Input
              id="quotationCustomerPhone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="tel"
              maxLength={MAX_CUSTOMER_PHONE}
              placeholder="mis. 0812 3456 7890"
              aria-describedby="quotationPhoneHint"
            />
            <p id="quotationPhoneHint" className="mt-1 text-xs text-muted-foreground">
              Tidak tercetak di PDF. Hanya terlihat oleh Anda dan admin.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="quotationNote">
              Catatan Internal <span className="font-normal text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              id="quotationNote"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              maxLength={MAX_INTERNAL_NOTE}
              rows={2}
              placeholder="mis. masih banding harga, tunggu gajian"
              aria-describedby="quotationNoteHint"
              className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
            />
            <p id="quotationNoteHint" className="mt-1 text-xs text-muted-foreground">
              <strong>Tidak tercetak di PDF</strong> dan tidak terlihat kasir.
            </p>
          </div>

          {mode === "cs" && (
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor="quotationSales">
                Oper ke Sales <span className="text-destructive">*</span>
              </label>
              <select
                id="quotationSales"
                value={salesUserId}
                onChange={(e) => setSalesUserId(e.target.value)}
                className="w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
              >
                <option value="" disabled>
                  Pilih salah satu…
                </option>
                {salesOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
                <option value={TIDAK_OPER}>Tidak oper — simpan atas nama saya</option>
              </select>
              {salesOptions.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Belum ada akun berperan Sales. Anda masih bisa memilih &ldquo;Tidak oper&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!bisaKirim} className="w-full sm:w-auto">
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Terbitkan &amp; Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
