"use client"

import Image from "next/image"
import { Check } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import type { BuilderVariation } from "@/store/new-builder"

type VariationListProps = {
  variations: BuilderVariation[]
  /**
   * Id varian yang SUDAH masuk rakitan untuk langkah ini. Dipakai menandai
   * pilihan yang sudah ada — bukan mencegahnya dipilih lagi: menekan varian
   * yang sama sekali lagi menambah kuantitasnya, sama seperti menekan Select
   * dua kali pada produk biasa.
   */
  selectedVariationIds: number[]
  onPick: (variation: BuilderVariation) => void
  /** Gambar induk, dipakai untuk varian yang tidak punya gambarnya sendiri. */
  fallbackImage?: string
}

/**
 * Daftar varian yang bisa ditekan — dipakai bersama oleh `VariationPickerDialog`
 * dan `BuilderQuickViewDialog`.
 *
 * Diekstrak jadi satu komponen supaya kedua layar itu tidak pernah berbeda:
 * harga yang tampil per baris adalah HARGA VARIANNYA SENDIRI dari katalog —
 * bukan harga induk, dan bukan hasil hitungan apa pun (CLAUDE.md §2.7). Varian
 * yang habis tetap terdaftar tapi tidak bisa ditekan: pelanggan berhak tahu
 * barangnya ada, cuma sedang kosong.
 *
 * Komponen ini sengaja tidak mengurus gulungan atau tinggi maksimum — itu urusan
 * pemanggilnya, karena ruang yang tersedia di dialog pemilih varian dan di Quick
 * Preview tidak sama.
 */
export function VariationList({
  variations,
  selectedVariationIds,
  onPick,
  fallbackImage,
}: VariationListProps) {
  const terpilih = new Set(selectedVariationIds)

  if (variations.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Belum ada opsi yang tersedia untuk produk ini.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {variations.map((variation) => {
        const habis = variation.stock <= 0
        const sudahDipilih = terpilih.has(variation.id)
        const adaDiskon =
          variation.salePrice > 0 && variation.regularPrice > variation.salePrice

        return (
          <button
            key={variation.id}
            type="button"
            disabled={habis}
            onClick={() => onPick(variation)}
            aria-pressed={sudahDipilih}
            className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
              habis
                ? "cursor-not-allowed border-border/50 opacity-55"
                : sudahDipilih
                  ? "cursor-pointer border-brand-green bg-brand-green/5 hover:bg-brand-green/10"
                  : "cursor-pointer border-border/60 hover:border-blue-500 hover:bg-accent"
            }`}
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-secondary/50">
              <Image
                src={variation.image || fallbackImage || "/placeholder.jpg"}
                alt={variation.label}
                fill
                // Wadahnya tetap 48px di semua ukuran layar.
                sizes="48px"
                className="object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{variation.label}</span>
                {sudahDipilih && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-brand-green" strokeWidth={3} />
                )}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span
                  className={`text-sm font-bold ${adaDiskon ? "text-sale-red" : "text-foreground"}`}
                >
                  {formatRupiah(variation.price)}
                </span>
                {adaDiskon && (
                  <span className="text-[10px] text-muted-foreground line-through">
                    {formatRupiah(variation.regularPrice)}
                  </span>
                )}
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                habis ? "bg-muted text-muted-foreground" : "bg-brand-green/10 text-brand-green"
              }`}
            >
              {habis ? "HABIS" : "TERSEDIA"}
            </span>
          </button>
        )
      })}
    </div>
  )
}
