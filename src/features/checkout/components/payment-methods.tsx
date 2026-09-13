"use client"

import { useState } from "react"
import { Check, Copy, Landmark, ShieldCheck } from "lucide-react"

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

type BankAccount = (typeof BANK_ACCOUNTS)[number]

/**
 * Rekening resmi HNS di halaman checkout: tiga tombol bank, dan menekan salah
 * satunya membuka dialog berisi nomor rekening bank ITU SAJA.
 *
 * Kenapa satu per satu, bukan ketiganya sekaligus di layar? Karena yang
 * dilakukan orang di sini adalah menyalin satu nomor lalu menempelkannya ke
 * m-banking. Tiga nomor berdampingan — masing-masing 10–15 digit tanpa arti
 * visual yang membedakan — adalah tiga kesempatan menyalin yang keliru, dan
 * kekeliruannya baru ketahuan setelah uangnya berpindah. Saat dialog terbuka
 * hanya ada satu nomor di layar, dan namanya tercetak di atasnya.
 *
 * Komponen ini TIDAK menghitung, menjumlahkan, atau menampilkan angka rupiah
 * apa pun — ia hanya menampilkan nomor rekening. Tidak ada yang perlu
 * dicocokkan dengan katalog di sini (CLAUDE.md §2.7).
 */
export function PaymentMethods() {
  const [selected, setSelected] = useState<BankAccount | null>(null)

  return (
    <section
      aria-labelledby="metode-pembayaran"
      className="rounded-xl border bg-card p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Landmark className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="metode-pembayaran" className="text-base font-bold">
            Rekening Pembayaran
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Pilih bank untuk melihat nomor rekeningnya.
          </p>
        </div>
      </div>

      {/* `flex-wrap`, bukan grid kolom-tetap: jumlah banknya bisa berubah, dan
          membungkus sendiri lebih tahan daripada jumlah kolom yang dipatok. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {BANK_ACCOUNTS.map((account) => (
          <button
            key={account.bank}
            type="button"
            onClick={() => setSelected(account)}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-bold transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {account.bank}
            <span className="text-xs font-medium text-muted-foreground">
              Lihat
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {/*
          Kalimat kedua bukan hiasan. Penipuan yang menyamar sebagai toko
          biasanya menyodorkan rekening atas nama perorangan; menyatakan lebih
          dulu bahwa HNS tidak pernah begitu memberi pelanggan cara memeriksa
          sendiri sebelum uangnya berpindah.
        */}
        <span>
          Semua rekening atas nama <strong className="font-semibold text-foreground">{BANK_ACCOUNT_HOLDER}</strong>. HNS tidak pernah
          meminta transfer ke rekening pribadi.
        </span>
      </p>

      <AccountDialog
        account={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </section>
  )
}

/**
 * Dialog satu rekening.
 *
 * `account` merangkap dua peran — isi dialog DAN penanda terbuka/tertutup —
 * karena keduanya memang selalu berubah bersamaan: tidak ada keadaan "terbuka
 * tanpa bank" yang masuk akal di sini. Bandingkan dengan
 * `VariationPickerDialog` yang sengaja memisah keduanya supaya animasi
 * tutupnya sempat terlihat; di sini isinya cuma teks, jadi tidak ada yang
 * hilang saat ia lenyap bersama dialognya.
 */
function AccountDialog({
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
