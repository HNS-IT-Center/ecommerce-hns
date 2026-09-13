"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToastManager } from "@/components/ui/toast"
import { BANK_ACCOUNTS, BANK_ACCOUNT_HOLDER } from "@/lib/constants/contact"

export type BankAccount = (typeof BANK_ACCOUNTS)[number]

/**
 * Dialog satu rekening — dipakai bersama oleh blok rekening di checkout
 * (`payment-methods.tsx`) dan chip di footer (`footer-payment-methods.tsx`).
 *
 * Dipisah ke berkasnya sendiri supaya nomor rekening hanya punya SATU tempat
 * ditampilkan. Dua salinan dialog berarti dua kesempatan memperbaiki sebagian
 * lalu lupa sisanya — alasan yang sama seperti `BANK_ACCOUNTS` di
 * `lib/constants/contact.ts`.
 *
 * `account` merangkap dua peran — isi dialog DAN penanda terbuka/tertutup —
 * karena keduanya selalu berubah bersamaan: tidak ada keadaan "terbuka tanpa
 * bank" yang masuk akal di sini. Bandingkan dengan `VariationPickerDialog`
 * yang sengaja memisah keduanya supaya animasi tutupnya sempat terlihat; di
 * sini isinya cuma teks, jadi tidak ada yang hilang saat ia lenyap bersama
 * dialognya.
 */
export function BankAccountDialog({
  account,
  onOpenChange,
}: {
  account: BankAccount | null
  onOpenChange: (open: boolean) => void
}) {
  const toastManager = useToastManager()
  const [tersalin, setTersalin] = useState(false)

  const handleCopy = async () => {
    if (!account) return

    try {
      await navigator.clipboard.writeText(account.nomor)
      setTersalin(true)
      // Kembali ke keadaan semula supaya tombolnya bisa ditekan lagi — orang
      // kerap menyalin dua kali karena ragu yang pertama berhasil.
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      // Clipboard bisa ditolak izinnya (atau tidak ada di konteks non-HTTPS).
      // Nomornya ikut ditampilkan di toast supaya masih bisa disalin manual —
      // pola yang sama dengan `share-button.tsx`.
      toastManager.add({
        title: "Gagal menyalin otomatis",
        description: `Nomor rekening ${account.bank}: ${account.nomor}`,
        priority: "low",
        timeout: 6000,
      })
    }
  }

  return (
    <Dialog open={account !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{account?.bank}</DialogTitle>
          <DialogDescription>
            Transfer ke rekening berikut, lalu kirim bukti bayar ke CS lewat
            WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/40 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Nomor Rekening
          </p>
          {/*
            `font-mono` + `tabular-nums`: digitnya sama lebar, jadi mata bisa
            mencocokkan per kelompok saat mengetik ulang ke m-banking.
            `select-all` membuat satu klik memilih seluruhnya bagi orang yang
            lebih percaya menyalin sendiri daripada menekan tombol.
          */}
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums break-all select-all">
            {account?.nomor}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            a.n. <strong className="font-semibold text-foreground">{BANK_ACCOUNT_HOLDER}</strong>
          </p>
        </div>

        <Button onClick={handleCopy} className="w-full" size="lg">
          {tersalin ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              Tersalin
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Salin Nomor Rekening
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
