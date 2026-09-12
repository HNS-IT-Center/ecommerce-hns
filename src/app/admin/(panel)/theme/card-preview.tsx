"use client"

import { ShoppingBag, Star } from "lucide-react"

import { formatRupiah } from "@/lib/utils"

/**
 * Tiruan kartu produk untuk kotak pratinjau.
 *
 * Sama seperti `ChromePreview`: kelas warnanya sengaja disamakan dengan
 * `src/components/ui/product-card.tsx` (`bg-card`, `text-card-foreground`,
 * `--card-price`, `--card-badge-*`) supaya token dari tema mendarat persis
 * seperti di produksi. Bentuknya disederhanakan dan akan menyimpang seiring
 * kartu aslinya berubah — itu diterima.
 *
 * Kotak gambarnya `bg-white` MENTAH, bukan token — sama seperti kartu
 * aslinya, karena foto produk PNG berlatar putih. Jadi ia memang tidak ikut
 * berubah saat warna tema diganti, dan pratinjau ini harus menunjukkan itu.
 */
export function CardPreview() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Kartu dengan badge diskon */}
      <div className="relative flex flex-col rounded-xl bg-card shadow-md">
        <div className="absolute -left-1.5 top-3 z-10 drop-shadow-sm">
          <div className="rounded-r-md rounded-tl-md bg-(--card-badge-sale) px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
            20%
          </div>
          <div
            className="h-1.5 w-1.5 bg-(--card-badge-sale-fold)"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        </div>

        <div className="flex aspect-square w-full items-center justify-center rounded-t-xl bg-white">
          <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
        </div>

        <div className="flex flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-card-foreground">
            Contoh Produk Diskon
          </p>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-2 w-2 fill-current text-amber-400" />
            ))}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-(--card-price)">
              {formatRupiah(1200000)}
            </span>
            <span className="rounded bg-(--card-price)/10 px-1 py-0.5 text-[8px] font-bold text-(--card-price)">
              -20%
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground line-through">
            {formatRupiah(1500000)}
          </span>
        </div>
      </div>

      {/* Kartu dengan badge HOT */}
      <div className="relative flex flex-col rounded-xl bg-card shadow-md">
        <div className="absolute -left-1.5 top-3 z-10 drop-shadow-sm">
          <div className="rounded-r-md rounded-tl-md bg-(--card-badge-hot) px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            HOT
          </div>
          <div
            className="h-1.5 w-1.5 bg-(--card-badge-hot-fold)"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        </div>

        <div className="flex aspect-square w-full items-center justify-center rounded-t-xl bg-white">
          <ShoppingBag className="h-8 w-8 text-muted-foreground/30" />
        </div>

        <div className="flex flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-card-foreground">
            Contoh Produk Terlaris
          </p>
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-2 w-2 fill-current text-amber-400" />
            ))}
          </div>
          <span className="text-xs font-bold text-card-foreground">
            {formatRupiah(890000)}
          </span>
          <span className="text-[9px] text-muted-foreground">Terjual 120+</span>
        </div>
      </div>
    </div>
  )
}
