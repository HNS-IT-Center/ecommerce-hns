"use client"

import { useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Eye, ExternalLink } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type PcBuildQuoteRow = {
  id: number
  code: string
  items: Array<{
    productId: number
    name: string
    sku: string | null
    price: number
    quantity: number
    stepName: string | null
    /**
     * Opsi varian yang dipilih pelanggan, mis. "1TB · Hitam". Opsional karena
     * quotation yang dicetak sebelum medan ini ada tidak memilikinya — bukan
     * karena boleh diabaikan saat ada.
     */
    variationLabel?: string | null
  }>
  total: number
  itemCount: number
  createdAt: Date
  updatedAt: Date
}

type Props = {
  quotes: PcBuildQuoteRow[]
  totalPages: number
  currentPage: number
}

export function PcBuildLogsTable({ quotes, totalPages, currentPage }: Props) {
  const [selected, setSelected] = useState<PcBuildQuoteRow | null>(null)

  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-background p-12 text-center text-muted-foreground shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-2">Belum ada quotation</h2>
        <p>Quotation akan tercatat di sini saat pelanggan mencetak rakitan dari PC Builder.</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Dibuat</th>
              <th className="px-4 py-3">Diperbarui</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                  {quote.code}
                </td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {quote.itemCount} komponen
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap">
                  {formatRupiah(quote.total)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {format(quote.createdAt, "d MMM yyyy, HH:mm", { locale: localeId })}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {format(quote.updatedAt, "d MMM yyyy, HH:mm", { locale: localeId })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setSelected(quote)}
                      className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label={`Lihat rincian ${quote.code}`}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <Link
                      href={`/verify/${quote.code}`}
                      target="_blank"
                      className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      aria-label={`Buka halaman verifikasi ${quote.code}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View — tabel enam kolom di atas hanya bisa dibaca dengan
          menggeser ke samping di layar ponsel, dan kolom yang tergeser keluar
          layar praktis tidak terbaca. Susunan kartu menampilkan medan yang sama
          secara menurun, mengikuti pola `logs-table.tsx`. */}
      <div className="md:hidden flex flex-col gap-4">
        {quotes.map((quote) => (
          <div
            key={quote.id}
            className="rounded-xl border border-border bg-background p-4 shadow-sm flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-mono text-xs font-bold">{quote.code}</span>
              <span className="text-sm font-black tabular-nums text-sale-red">
                {formatRupiah(quote.total)}
              </span>
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <span>{quote.itemCount} komponen</span>
              <span>
                Dibuat: {format(quote.createdAt, "d MMM yyyy, HH:mm", { locale: localeId })}
              </span>
              <span>
                Diperbarui: {format(quote.updatedAt, "d MMM yyyy, HH:mm", { locale: localeId })}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <button
                onClick={() => setSelected(quote)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted/70 cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Rincian
              </button>
              <Link
                href={`/verify/${quote.code}`}
                target="_blank"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold transition-colors hover:bg-muted cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Verifikasi
              </Link>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              // Di-clamp, bukan sekadar `currentPage - 1`: `pointer-events-none`
              // hanya memblokir mouse, jadi tautan yang dicapai lewat keyboard
              // masih bisa mengarah ke `page=0` dan menghasilkan skip negatif.
              href={`/admin/logs?tab=pc-build&page=${Math.max(1, currentPage - 1)}`}
              aria-disabled={currentPage <= 1}
              className={`flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "cursor-pointer hover:bg-muted"
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Sebelumnya
            </Link>
            <Link
              href={`/admin/logs?tab=pc-build&page=${Math.min(totalPages, currentPage + 1)}`}
              aria-disabled={currentPage >= totalPages}
              className={`flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold transition-colors ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-40"
                  : "cursor-pointer hover:bg-muted"
              }`}
            >
              Berikutnya
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{selected?.code}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="max-h-[60vh] overflow-y-auto">
              <ul className="divide-y divide-border">
                {selected.items.map((item, idx) => (
                  <li key={`${item.productId}-${idx}`} className="flex gap-3 py-2.5">
                    <span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {item.stepName && (
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {item.stepName}
                        </p>
                      )}
                      <p className="text-xs font-semibold leading-snug">{item.name}</p>
                      {/* Opsi variannya ditulis sebagai barisnya sendiri: dua
                          kapasitas dari SSD yang sama tersimpan dengan `name`
                          yang bisa persis sama, jadi tanpa baris ini staff
                          melihat dua komponen kembar dengan dua harga berbeda
                          dan tidak punya cara tahu mana yang mana. */}
                      {item.variationLabel && (
                        <p className="mt-0.5 inline-flex rounded bg-blue-600/10 px-1.5 py-0.5 text-[10px] font-bold leading-tight text-blue-700 dark:text-blue-300">
                          {item.variationLabel}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatRupiah(item.price)} &times; {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums">
                      {formatRupiah(item.price * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Jasa rakit sudah jadi komponen biasa di daftar di atas, jadi
                  subtotal selalu sama dengan total — cukup satu baris. */}
              <div className="mt-3 border-t border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-sm font-black tabular-nums text-sale-red">
                    {formatRupiah(selected.total)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
