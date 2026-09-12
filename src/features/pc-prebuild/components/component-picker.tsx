"use client"

import Image from "next/image"
import { Check, TriangleAlert } from "lucide-react"

import { COMPONENT_ROLE_ICONS } from "../lib/component-icons"
import { chosenOption, type PrebuildSelection } from "../lib/selection"
import type { PrebuildComponent } from "../lib/types"

/**
 * Satu komponen di daftar isi paket.
 *
 * ## Harga per komponen SENGAJA tidak ditampilkan
 *
 * Yang dijual di halaman ini adalah paketnya, bukan tujuh barang yang kebetulan
 * dibundel. Harga satuan di tiap baris mengundang pelanggan menjumlahkan
 * sendiri lalu menawar selisihnya, dan angka yang muncul dari penjumlahan itu
 * bukan angka yang bisa dipenuhi CS.
 *
 * ## Pilihan tukar
 *
 * Yang dikirim ke pemanggil adalah `productId`, bukan indeks pilihan
 * (docs/11-pc-prebuild.md §5) — id itu jugalah yang ikut ke `?pick=` saat
 * pelanggan menekan "Rakit Sendiri". Indeks akan menunjuk produk lain begitu
 * staff mengurutkan ulang pilihannya di panel admin, tanpa error dan tanpa ada
 * yang tahu.
 *
 * Stok kosong TIDAK menyembunyikan pilihan dan tidak memindahkan bawaan — ia
 * ditandai. Pelanggan tetap boleh memilihnya; HNS yang mengabari kalau harus
 * inden.
 */

type Props = {
  component: PrebuildComponent
  selection: PrebuildSelection
  onSelect: (componentKey: string, productId: number) => void
}

export function ComponentPicker({ component, selection, onSelect }: Props) {
  const Ikon = COMPONENT_ROLE_ICONS[component.role]
  const terpilih = chosenOption(component, selection)

  if (component.missing || !terpilih) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-sale-red/40 bg-sale-red/5 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground">
          <Ikon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {component.roleLabel}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-sale-red">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Sedang tidak tersedia
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Komponen ini tidak ikut dihitung. Hubungi kami untuk penggantinya.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-background p-1">
          {terpilih.image ? (
            <Image
              src={terpilih.image}
              alt=""
              fill
              sizes="64px"
              className="object-contain p-1"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Ikon className="h-6 w-6" strokeWidth={1.5} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Ikon className="h-3.5 w-3.5" strokeWidth={2} />
            {component.roleLabel}
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug">{terpilih.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{terpilih.quantity} pcs</span>
            {!terpilih.inStock && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning">
                Stok kosong
              </span>
            )}
          </div>
        </div>
      </div>

      {component.branching && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bisa diganti
          </p>
          <div className="flex flex-wrap gap-1.5">
            {component.options.map((option) => {
              const aktif = option.productId === terpilih.productId
              return (
                <button
                  key={option.productId}
                  type="button"
                  onClick={() => onSelect(component.key, option.productId)}
                  aria-pressed={aktif}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${
                    aktif
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "hover:border-brand-green/50 hover:text-foreground"
                  }`}
                >
                  {aktif && <Check className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{option.label}</span>
                  {!option.inStock && (
                    <span className="shrink-0 text-[10px] font-normal text-warning">(kosong)</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
