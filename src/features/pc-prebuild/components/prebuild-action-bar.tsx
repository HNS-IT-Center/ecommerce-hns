"use client"

import Link from "next/link"
import { Check, ShoppingCart, Wrench } from "lucide-react"

import { formatRupiah } from "@/lib/utils"

/**
 * Bilah aksi yang menempel di bawah halaman paket.
 *
 * Sticky, bukan tetap (`fixed`): ia tinggal di dalam aliran halaman, jadi ia
 * berhenti di atas footer alih-alih menutupinya, dan tidak perlu ada padding
 * bayangan di bawah konten yang harus dijaga tetap sepadan.
 *
 * Harga di sini adalah PENJUMLAHAN harga satuan katalog atas pilihan yang
 * sedang aktif — bukan angka yang diturunkan dari rumus (CLAUDE.md §2.7).
 * Server tetap menghitung ulang seluruhnya saat pesanan dikirim ke CS.
 */

type Props = {
  total: number
  /** Jumlah komponen yang seluruh pilihannya hilang dari katalog. */
  missingCount: number
  onAddToCart: () => void
  /** Sudah masuk keranjang — tombolnya berubah, bukan hilang. */
  added: boolean
  /** Tidak ada satu pun komponen yang bisa dipesan. */
  disabled?: boolean
  builderHref: string
}

export function PrebuildActionBar({
  total,
  missingCount,
  onAddToCart,
  added,
  disabled = false,
  builderHref,
}: Props) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-8 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Total paket
            {/* Yang hilang dari katalog TIDAK disembunyikan. Total yang lebih
                murah tanpa keterangan membuat pelanggan mengira paketnya utuh —
                lalu CS yang harus menjelaskannya (docs/11-pc-prebuild.md §5). */}
            {missingCount > 0 && (
              <span className="ml-1.5 font-semibold text-sale-red">
                (sebagian — {missingCount} komponen tidak tersedia)
              </span>
            )}
          </p>
          <p className="truncate text-xl font-extrabold text-sale-red md:text-2xl">
            {formatRupiah(total)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={builderHref}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors hover:border-brand-green hover:text-brand-green sm:flex-none"
          >
            <Wrench className="h-4 w-4" />
            Ubah Rakitan
          </Link>

          <button
            type="button"
            onClick={onAddToCart}
            disabled={disabled}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-md transition-opacity enabled:hover:opacity-90 disabled:opacity-50 sm:flex-none"
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {added ? "Tambah Lagi" : "Masukkan Keranjang"}
          </button>
        </div>
      </div>
    </div>
  )
}
