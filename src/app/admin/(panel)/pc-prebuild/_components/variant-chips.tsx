"use client"

import { TriangleAlert } from "lucide-react"

import type { PrebuildVariation } from "@/lib/pc-prebuild/products"
import { formatRupiah } from "@/lib/utils"

import { kunciBarang } from "./item-keys"

/**
 * Peringatan baris kembar. Nadanya sengaja merah, bukan kuning seperti stok
 * kosong: stok kosong tetap tersimpan, baris kembar TIDAK.
 */
export function DuplicateWarning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-sale-red/5 px-2.5 py-2 text-xs text-sale-red">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  )
}

/**
 * Pemilih varian — dipakai barang UTAMA maupun pilihan tukar.
 *
 * Chip varian bukan radio: staff menyalakan **beberapa varian sekaligus**, dan
 * PELANGGAN yang memilih salah satunya di halaman paket. Varian kedua dan
 * seterusnya tersimpan sebagai `alternatives` yang menunjuk produk yang sama —
 * bukan sebagai barang tambahan, jadi hanya varian bawaan yang masuk total
 * paket (docs/11-pc-prebuild.md §2).
 *
 * Varian yang kuncinya sudah dipakai baris lain DIMATIKAN, bukan sekadar
 * ditandai: memilihnya cuma akan menghasilkan baris yang dibuang parser.
 */
export function VariantChips({
  productId,
  variations,
  selectedIds,
  defaultId,
  canAdd,
  takenKeys,
  onToggle,
  compact = false,
}: {
  productId: number
  variations: PrebuildVariation[]
  /** Varian yang sedang ditawarkan. Tidak pernah kosong selama produknya terpilih. */
  selectedIds: number[]
  /**
   * Varian yang jadi BAWAAN — hanya untuk produk utama. Kelompok pilihan tukar
   * tidak punya bawaan: seluruh isinya memang pilihan.
   */
  defaultId?: number
  /** Jatah pilihan masih ada. Kalau habis, varian yang belum aktif dimatikan. */
  canAdd: boolean
  /** Kunci milik baris LAIN di lingkup yang sama. Kunci baris ini sendiri tidak ikut. */
  takenKeys: Set<string>
  onToggle: (variationId: number) => void
  compact?: boolean
}) {
  return (
    <div>
      <p
        className={`mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        Varian
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variations.map((v) => {
          const aktif = selectedIds.includes(v.id)
          const bawaan = v.id === defaultId
          const terpakai =
            !aktif && takenKeys.has(kunciBarang({ productId, variationId: v.id }))

          // Varian terakhir tidak boleh dimatikan: produk tanpa varian terpilih
          // masuk total sebagai harga induk, yang untuk VARIABLE sering nol.
          const terakhir = aktif && selectedIds.length <= 1
          const jatahHabis = !aktif && !canAdd
          const mati = terpakai || terakhir || jatahHabis

          return (
            <button
              key={v.id}
              type="button"
              disabled={mati}
              aria-pressed={aktif}
              title={
                terpakai
                  ? "Varian ini sudah dipakai baris lain di langkah yang sama"
                  : terakhir
                    ? "Minimal satu varian harus ditawarkan"
                    : jatahHabis
                      ? "Jatah pilihan untuk barang ini sudah penuh"
                      : undefined
              }
              onClick={() => onToggle(v.id)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold transition-colors ${
                compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
              } ${
                aktif
                  ? "border-brand-green bg-brand-green text-primary-foreground"
                  : mati
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-brand-green hover:text-brand-green"
              } ${terakhir ? "cursor-not-allowed" : ""}`}
            >
              {/* Label varian bisa panjang ("1TB · Hitam · NVMe Gen4").
                  Dipotong, dan harganya yang TIDAK boleh menyusut — angka
                  yang terpotong separuh lebih buruk daripada nama yang
                  terpotong. */}
              <span className="min-w-0 truncate">{v.label}</span>
              <span className={`shrink-0 ${aktif ? "opacity-80" : "text-muted-foreground"}`}>
                {formatRupiah(v.price)}
              </span>
              {v.stock <= 0 && (
                <span className={`shrink-0 ${aktif ? "opacity-80" : "text-sale-red"}`}>
                  · habis
                </span>
              )}
              {bawaan && <span className="shrink-0 opacity-80">· bawaan</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
