import Link from "next/link"
import { notFound } from "next/navigation"

import { getPrisma } from "@/lib/prisma/client"
import { getQuoteByCode, type QuoteLineItem } from "@/lib/api/pc-build-quotes"
import { formatRupiah } from "@/lib/utils"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Verifikasi Quotation — HNS IT Center",
  // Halaman ini berisi data transaksi pelanggan; jangan sampai terindeks.
  robots: { index: false, follow: false },
}

export default async function VerifyQuotePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const quote = await getQuoteByCode(decodeURIComponent(code))

  if (!quote) notFound()

  const items = quote.items as unknown as QuoteLineItem[]

  // Harga terkini untuk dibandingkan dengan snapshot saat quotation dibuat.
  const prisma = getPrisma()
  const current = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, regularPrice: true, salePrice: true },
  })

  const currentPriceById = new Map(
    current.map((p) => {
      const sale = p.salePrice ? Number(p.salePrice) : 0
      const regular = p.regularPrice ? Number(p.regularPrice) : 0
      return [p.id, sale > 0 ? sale : regular]
    })
  )

  const rows = items.map((item) => {
    const currentPrice = currentPriceById.get(item.productId) ?? null
    return {
      ...item,
      currentPrice,
      changed: currentPrice !== null && currentPrice !== item.price,
    }
  })

  const hasChanges = rows.some((r) => r.changed)
  const currentTotal =
    rows.reduce((acc, r) => acc + (r.currentPrice ?? r.price) * r.quantity, 0) +
    Number(quote.assemblyFee)

  const issued = quote.createdAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 bg-muted/20 py-8">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  Quotation Terverifikasi
                </p>
                <h1 className="mt-1 font-mono text-xl font-black tracking-tight md:text-2xl">
                  {quote.code}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">Diterbitkan {issued}</p>
              </div>
              <div className="rounded-full bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green">
                ✓ Asli
              </div>
            </div>

            {hasChanges && (
              <div className="mt-5 rounded-xl border border-warning/30 bg-warning/10 p-4">
                <p className="text-sm font-bold">Harga telah berubah</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sebagian harga sudah tidak sama dengan saat quotation diterbitkan. Harga
                  yang berlaku adalah harga pada sistem saat transaksi.
                </p>
              </div>
            )}

            <ul className="mt-5 divide-y divide-border">
              {rows.map((row, idx) => (
                <li key={`${row.productId}-${idx}`} className="flex gap-3 py-3">
                  <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    {row.stepName && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {row.stepName}
                      </p>
                    )}
                    <p className="text-sm font-semibold leading-snug">{row.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRupiah(row.price)} &times; {row.quantity}
                    </p>
                    {row.changed && row.currentPrice !== null && (
                      <p className="mt-0.5 text-xs font-semibold text-warning-foreground">
                        Harga terkini: {formatRupiah(row.currentPrice)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums">
                      {formatRupiah(row.price * row.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-1.5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Subtotal komponen</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(Number(quote.subtotal))}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Jasa rakit</span>
                <span className="font-semibold tabular-nums">
                  {formatRupiah(Number(quote.assemblyFee))}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm font-bold">Total saat diterbitkan</span>
                <span className="text-lg font-black tabular-nums text-sale-red">
                  {formatRupiah(Number(quote.total))}
                </span>
              </div>
              {hasChanges && (
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-bold">Total harga terkini</span>
                  <span className="text-lg font-black tabular-nums">
                    {formatRupiah(currentTotal)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Dokumen ini diterbitkan otomatis oleh sistem HNS IT Center.{" "}
            <Link href="/build-pc" className="font-semibold underline hover:text-foreground">
              Rakit PC Anda sendiri
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
