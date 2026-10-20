import { BadgePercent } from "lucide-react"

import { formatDiscountEndDate } from "@/lib/pc-prebuild/discount"
import { formatRupiah } from "@/lib/utils"

import type { SelectionPrice } from "../lib/selection"

/**
 * Tangga harga "Diskon++" di halaman paket (docs/11-pc-prebuild.md §12).
 *
 * Harga normal komponen → diskon komponen → harga setelah diskon komponen →
 * potongan paket → harga paket. Semua angkanya sudah jadi di
 * `selectionPrice()`; di sini tidak ada satu pun penjumlahan (CLAUDE.md §2.7).
 *
 * Yang ditampilkan SUBTOTAL, bukan harga per komponen — keputusan yang sama
 * dengan daftar isi paket (`component-picker.tsx`).
 *
 * Baris yang tidak punya isi tidak dirender: tanpa obral komponen tidak ada
 * baris "Diskon komponen" maupun subtotal antara, tanpa potongan paket tidak
 * ada baris Diskon++. Tanpa keduanya kartu ini tidak dirender sama sekali —
 * kartu hemat berisi "Rp 0" lebih buruk daripada tidak ada kartu.
 */

type Props = {
  price: SelectionPrice
  /** Hari terakhir potongan paket berlaku (`YYYY-MM-DD`), kalau dibatasi. */
  discountEndsAt: string | null
}

export function PrebuildPriceLadder({ price, discountEndsAt }: Props) {
  if (!(price.totalSavings > 0)) return null

  const adaDiskonKomponen = price.itemSavings > 0
  const adaDiskonPaket = price.discount > 0

  return (
    <section
      aria-label="Rincian harga paket"
      className="overflow-hidden rounded-2xl border-2 border-sale-red/40 bg-card shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 bg-sale-red px-4 py-2.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <BadgePercent className="h-5 w-5 shrink-0" aria-hidden />
          <p className="text-lg font-black uppercase italic leading-none tracking-tight md:text-xl">
            {adaDiskonPaket ? "Diskon++" : "Harga Hemat"}
          </p>
          {adaDiskonPaket && adaDiskonKomponen && (
            <span className="hidden truncate text-[11px] font-semibold text-white/85 sm:inline">
              Diskon komponen + potongan paket
            </span>
          )}
        </div>
        {price.savingsPercent > 0 && (
          <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-sm font-black leading-none text-sale-red tabular-nums">
            &minus;{price.savingsPercent}%
          </span>
        )}
      </header>

      <div className="space-y-2 px-4 py-3.5 text-sm">
        <Row label="Harga normal komponen">
          <span className="font-semibold text-muted-foreground line-through tabular-nums">
            {formatRupiah(price.regularTotal)}
          </span>
        </Row>

        {adaDiskonKomponen && (
          <Row label="Diskon komponen">
            <span className="font-bold text-brand-green tabular-nums">
              &minus; {formatRupiah(price.itemSavings)}
            </span>
          </Row>
        )}

        {/* Subtotal antara hanya berarti kalau masih ada tingkat berikutnya. */}
        {adaDiskonKomponen && adaDiskonPaket && (
          <Row label="Harga setelah diskon komponen" emphasis>
            <span className="font-bold line-through decoration-sale-red/70 tabular-nums">
              {formatRupiah(price.normal)}
            </span>
          </Row>
        )}

        {adaDiskonPaket && (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span className="rounded bg-sale-red px-1.5 py-0.5 text-[10px] font-black uppercase italic leading-none text-white">
                  Diskon++
                </span>
                Potongan paket
              </span>
              {discountEndsAt && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Berlaku s.d. {formatDiscountEndDate(discountEndsAt, "short")}
                </p>
              )}
            </div>
            <span className="shrink-0 font-bold text-brand-green tabular-nums">
              &minus; {formatRupiah(price.discount)}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-dashed pt-3">
          <span className="text-xs font-black uppercase tracking-wide">Harga paket</span>
          <span className="text-2xl font-extrabold text-sale-red tabular-nums md:text-3xl">
            {formatRupiah(price.final)}
          </span>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-2.5">
          <BadgePercent className="h-6 w-6 shrink-0 text-brand-green" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase leading-none tracking-[0.15em] text-brand-green">
              Total hemat
            </p>
            <p className="mt-1 text-lg font-black leading-none text-brand-green tabular-nums">
              {formatRupiah(price.totalSavings)}
            </p>
          </div>
        </div>

        {/* Potongan paket TIDAK ikut ke PC Builder: `/build-pc` menghitung harga
            komponen saja, dan quotation PC Build mencatat potongan 0. Tanpa
            kalimat ini, pelanggan yang menekan "Ubah Rakitan" melihat total
            naik tanpa tahu sebabnya. */}
        {adaDiskonPaket && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Diskon++ berlaku untuk pembelian sebagai paket ini. Rakitan yang diubah lewat
            &ldquo;Ubah Rakitan&rdquo; dihitung dengan harga komponen tanpa potongan paket.
          </p>
        )}
      </div>
    </section>
  )
}

function Row({
  label,
  emphasis = false,
  children,
}: {
  label: string
  emphasis?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={emphasis ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}
