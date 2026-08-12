"use client"

import { createContext, useContext } from "react"

export type ShareTarget = {
  /** Judul yang dibagikan, mis. nama produk. */
  title: string
  /**
   * Harga siap tampil (sudah diformat, mis. "Rp 20.500.000").
   *
   * Diformat di sisi pemanggil dan diterima apa adanya — komponen ini TIDAK
   * pernah menghitung atau menurunkan angka harga sendiri. Lihat CLAUDE.md §2.7.
   */
  priceLabel?: string
  /** Tautan pendek `domain/p/{id}` — bukan URL slug penuh. */
  url: string
}

/**
 * Kosong secara bawaan: hanya halaman yang benar-benar punya sesuatu untuk
 * dibagikan yang memasang provider ini. Halaman lain membaca `null` dan tombol
 * bagikan di header tidak dilukis sama sekali.
 */
const ShareTargetContext = createContext<ShareTarget | null>(null)

export function useShareTarget() {
  return useContext(ShareTargetContext)
}

/**
 * Memberi tahu header apa yang sedang bisa dibagikan di halaman ini.
 *
 * Dipasang halaman produk di sekeliling `Header`, pola yang sama dengan
 * `TransparentHeaderProvider` di sebelahnya. Lewat context, bukan prop, karena
 * `Header` dipakai puluhan halaman dan menambah prop opsional ke semuanya hanya
 * demi satu halaman berarti tiap pemanggil ikut menanggung detail yang tidak
 * berlaku baginya.
 */
export function ShareTargetProvider({
  value,
  children,
}: {
  value: ShareTarget
  children: React.ReactNode
}) {
  return (
    <ShareTargetContext.Provider value={value}>{children}</ShareTargetContext.Provider>
  )
}
