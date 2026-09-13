"use client"

import { useState } from "react"

import { BANK_ACCOUNTS } from "@/lib/constants/contact"
import {
  BankAccountDialog,
  type BankAccount,
} from "@/features/checkout/components/bank-account-dialog"

/**
 * Chip bank di footer — versi ringkas dari `PaymentMethods` di checkout.
 *
 * Dulu ketiganya `<span>` mati. Bentuknya (kotak berbingkai, latar terangkat)
 * membuat orang mencobanya, lalu tidak terjadi apa-apa — dan rekening yang
 * ingin dilihat hanya bisa dicapai lewat halaman checkout, yang butuh
 * keranjang terisi lebih dulu. Sekarang rekening bisa dilihat dari halaman
 * mana pun, karena footer ada di semuanya.
 *
 * Komponen klien tersendiri, BUKAN menjadikan `Footer` klien. `Footer` adalah
 * server component yang membaca tema dari database (`getThemeSettings`);
 * mengubahnya jadi klien berarti memindahkan pembacaan itu ke peramban. Yang
 * benar-benar butuh interaksi hanya sepetak kecil ini.
 *
 * Gayanya sengaja tidak memakai token tema seperti versi checkout: footer
 * berlatar navy tetap (`--primary-800`) yang tidak ikut berubah di mode gelap,
 * jadi `border`/`bg-card` di sini akan menghasilkan kotak yang salah warna.
 * Putih transparan mengikuti apa yang sudah dipakai tautan di sebelahnya.
 */
export function FooterPaymentMethods() {
  const [selected, setSelected] = useState<BankAccount | null>(null)

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {BANK_ACCOUNTS.map((account) => (
          <button
            key={account.bank}
            type="button"
            onClick={() => setSelected(account)}
            /* `cursor-pointer` eksplisit: sebagai `<span>` dulu ia tidak punya
               isyarat apa pun bahwa ia bisa ditekan, dan itu bagian dari
               kenapa orang mengira situsnya rusak. */
            className="cursor-pointer rounded border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white transition-colors hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {account.bank}
          </button>
        ))}
      </div>

      <BankAccountDialog
        account={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
