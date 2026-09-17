"use client"

import { useState } from "react"
import { CalendarX2, Info, TriangleAlert, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { RupiahInput } from "@/components/ui/rupiah-input"
import {
  MAX_PREBUILD_DISCOUNT,
  applicablePrebuildDiscount,
  isPrebuildDiscountActive,
  type PrebuildDiscount,
} from "@/lib/pc-prebuild/discount"
import { formatRupiah } from "@/lib/utils"

/**
 * Potongan harga untuk seluruh paket — permintaan PIC, 17 September 2026.
 *
 * Yang diisi staff adalah BESAR POTONGAN, bukan harga jadi. Harga komponen di
 * katalog naik-turun, dan potongan nominal ikut bergerak bersamanya; alasan
 * lengkapnya di `lib/pc-prebuild/discount.ts`.
 *
 * Dua keadaan yang membuat potongan TIDAK tampil ke pelanggan ditulis terang di
 * panel ini, bukan dibiarkan tersirat — staff yang tidak melihatnya akan
 * menjanjikan harga obral ke pelanggan yang di situs melihat harga normal:
 *
 * 1. masa berlakunya sudah lewat;
 * 2. potongannya menyamai atau melebihi total paket (biasanya karena harga
 *    komponen turun jauh sesudah potongan ditetapkan).
 */

type Props = {
  /** Total NORMAL susunan bawaan, dari katalog. */
  total: number
  discount: PrebuildDiscount | null
  onChange: (discount: PrebuildDiscount | null) => void
  /** Paket punya pilihan tukar — potongan yang sama berlaku untuk semuanya. */
  branching: boolean
}

export function DiscountPanel({ total, discount, onChange, branching }: Props) {
  // Jam dibaca sekali saat panel dipasang, bukan setiap render — cukup untuk
  // menilai "sudah lewat", dan render tetap murni.
  const [sekarang] = useState(() => Date.now())

  const amount = discount?.amount ?? 0
  const endsAt = discount?.endsAt ?? null

  const aktif = isPrebuildDiscountActive(discount, sekarang)
  const berlaku = aktif ? applicablePrebuildDiscount(amount, total) : 0
  const kebesaran = aktif && amount > 0 && total > 0 && berlaku === 0

  function ubah(next: { amount?: number; endsAt?: string | null }) {
    const nominal = Math.min(MAX_PREBUILD_DISCOUNT, next.amount ?? amount)
    if (nominal <= 0) {
      // Potongan nol = tidak ada potongan. Tanggalnya ikut dibuang: tanggal
      // berakhir tanpa potongan tidak punya arti apa pun.
      onChange(null)
      return
    }
    onChange({ amount: nominal, endsAt: next.endsAt === undefined ? endsAt : next.endsAt })
  }

  return (
    <div className="rounded-2xl border bg-card p-4 md:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold">
              Potongan paket{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <RupiahInput
              value={amount > 0 ? String(amount) : ""}
              onValueChange={(digits) => ubah({ amount: digits ? Number(digits) : 0 })}
              placeholder="0"
            />
            <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
              Dikurangkan dari total komponen. Kalau harga komponen berubah, harga paket ikut
              berubah — potongannya tetap.
            </span>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-semibold">
              Berlaku sampai{" "}
              <span className="font-normal text-muted-foreground">(opsional)</span>
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={endsAt ?? ""}
                disabled={amount <= 0}
                onChange={(e) => ubah({ endsAt: e.target.value || null })}
                className="min-w-0 flex-1"
              />
              {endsAt && (
                <button
                  type="button"
                  onClick={() => ubah({ endsAt: null })}
                  aria-label="Hapus tanggal berakhir"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-sale-red hover:text-sale-red"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">
              Kosong = berlaku terus. Kalau diisi, potongan berakhir di akhir hari itu (WIB).
            </span>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Total komponen</dt>
              <dd className="tabular-nums">{formatRupiah(total)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Potongan</dt>
              <dd className="tabular-nums text-brand-green">
                {berlaku > 0 ? `− ${formatRupiah(berlaku)}` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t pt-2">
              <dt className="font-bold">Harga paket</dt>
              <dd className="font-extrabold tabular-nums text-sale-red">
                {formatRupiah(total - berlaku)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {amount > 0 && !aktif && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <CalendarX2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Masa berlaku potongan sudah lewat — pelanggan melihat harga normal. Ubah atau hapus
          tanggalnya untuk menyalakannya lagi.
        </p>
      )}

      {kebesaran && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-sale-red/30 bg-sale-red/5 px-3 py-2 text-xs text-sale-red">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Potongan {formatRupiah(amount)} menyamai atau melebihi total komponen, jadi TIDAK
          diberlakukan — pelanggan melihat harga normal. Periksa harga komponennya atau kecilkan
          potongannya.
        </p>
      )}

      {branching && amount > 0 && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Potongan yang sama berlaku untuk pilihan tukar mana pun yang dipilih pelanggan. Hitungan
          di atas memakai susunan bawaan.
        </p>
      )}
    </div>
  )
}
