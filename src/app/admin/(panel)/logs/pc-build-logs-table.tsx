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
  }>
  subtotal: number
  assemblyFee: number
  total: number
  itemCount: number
  printCount: number
  createdAt: Date
  lastPrintedAt: Date
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
      <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Dicetak</th>
              <th className="px-4 py-3">Dibuat</th>
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
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {quote.printCount}&times;
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {format(quote.createdAt, "d MMM yyyy, HH:mm", { locale: localeId })}
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
                      href={`/q/${quote.code}`}
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/admin/logs?tab=pc-build&page=${currentPage - 1}`}
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
              href={`/admin/logs?tab=pc-build&page=${currentPage + 1}`}
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

              <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(selected.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jasa rakit</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(selected.assemblyFee)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5">
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
