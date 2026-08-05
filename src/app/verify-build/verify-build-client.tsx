"use client"

import * as React from "react"
import { Loader2, Search, AlertTriangle, CheckCircle2 } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatRupiah } from "@/lib/utils"
import { lookupBuildQuote, type VerifiedQuote } from "./actions"

export function VerifyBuildClient() {
  const [code, setCode] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [quote, setQuote] = React.useState<VerifiedQuote | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const result = await lookupBuildQuote(code)
    if (result.ok) {
      setQuote(result.quote)
    } else {
      setQuote(null)
      setError(result.error)
    }
    setIsLoading(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          Cek Rincian Rakitan PC
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Masukkan kode quotation yang tertera pada dokumen untuk melihat rincian harga
          per komponen saat dokumen itu dicetak.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="HNSPC-260804-VVGT"
            className="h-11 pl-9 font-mono uppercase"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="h-11 cursor-pointer px-6 font-bold sm:w-auto"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cek"}
        </Button>
      </form>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {quote && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="font-mono text-lg font-black tracking-tight">{quote.code}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Diterbitkan{" "}
                {new Date(quote.createdAt).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                &middot; dicetak {quote.printCount}&times;
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Terverifikasi
            </span>
          </div>

          {quote.hasChanges && (
            <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3.5">
              <p className="text-sm font-bold">Sebagian harga sudah berubah</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Harga yang berlaku adalah harga pada sistem saat transaksi.
              </p>
            </div>
          )}

          <ul className="mt-4 divide-y divide-border">
            {quote.items.map((item, idx) => (
              <li key={`${item.productId}-${idx}`} className="flex gap-3 py-3">
                <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {item.stepName && (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {item.stepName}
                    </p>
                  )}
                  <p className="text-sm font-semibold leading-snug">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatRupiah(item.price)} &times; {item.quantity}
                    {item.sku ? ` · SKU ${item.sku}` : ""}
                  </p>
                  {item.changed && item.currentPrice !== null && (
                    <p className="mt-0.5 text-xs font-semibold text-warning-foreground">
                      Harga terkini: {formatRupiah(item.currentPrice)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatRupiah(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1.5 border-t border-border pt-4">
            {/* Quotation lama menyimpan jasa rakit terpisah; yang baru sudah
                memasukkannya sebagai komponen biasa. */}
            {quote.assemblyFee > 0 && (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal komponen</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(quote.subtotal)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Jasa rakit</span>
                  <span className="font-semibold tabular-nums">
                    {formatRupiah(quote.assemblyFee)}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-2">
              <span className="text-sm font-bold">Total saat diterbitkan</span>
              <span className="text-lg font-black tabular-nums text-sale-red">
                {formatRupiah(quote.total)}
              </span>
            </div>
            {quote.hasChanges && (
              <div className="flex items-baseline justify-between pt-0.5">
                <span className="text-sm font-bold">Total harga terkini</span>
                <span className="text-lg font-black tabular-nums">
                  {formatRupiah(quote.currentTotal)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
