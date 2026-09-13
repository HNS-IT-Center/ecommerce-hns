"use client"

import { useState } from "react"
import { Landmark, ShieldCheck } from "lucide-react"

import { BANK_ACCOUNTS, BANK_ACCOUNT_HOLDER } from "@/lib/constants/contact"
import { BankAccountDialog, type BankAccount } from "./bank-account-dialog"

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
 *
 * Versi ringkasnya untuk footer ada di `footer-payment-methods.tsx`; dialognya
 * dipakai bersama lewat `bank-account-dialog.tsx`.
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

      <BankAccountDialog
        account={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </section>
  )
}
