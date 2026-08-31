import Link from "next/link"
import { SearchX } from "lucide-react"

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

/** Sama dengan yang dipakai form pencarian di /verify. */
const QUOTE_CODE_PATTERN = /^HNSPC-\d{6}-[A-Z0-9]{4}$/

/**
 * Kode tidak ketemu BUKAN `notFound()`.
 *
 * Salah ketik satu karakter saat menyalin kode dari dokumen cetak adalah hal
 * yang wajar terjadi, dan halaman 404 generik memperlakukannya seperti URL
 * rusak: pengguna tidak tahu apa yang salah dan tidak diberi jalan untuk
 * mencoba lagi. Di sini kodenya ditampilkan kembali supaya mudah dicocokkan
 * dengan dokumen, lengkap dengan tautan untuk mengulang pencarian.
 */
function QuoteNotFound({ code, malformed }: { code: string; malformed: boolean }) {
  // URL bisa diisi apa saja, termasuk string ribuan karakter. Kode aslinya cuma
  // 19 karakter, jadi apa pun di luar itu dipotong supaya kartunya tidak jebol.
  const shown = code.length > 24 ? `${code.slice(0, 24)}…` : code

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 bg-muted/20 py-8">
        <div className="mx-auto max-w-lg px-4 md:px-6">
          <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm md:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <SearchX className="h-6 w-6 text-muted-foreground" />
            </div>

            <h1 className="mt-4 text-lg font-bold md:text-xl">
              Rakitan PC tidak ditemukan
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {malformed ? (
                <>
                  Kode <span className="font-mono font-semibold">{shown}</span> tidak sesuai
                  format. Kode quotation selalu berawalan{" "}
                  <span className="font-mono font-semibold">HNSPC-</span>, contohnya{" "}
                  <span className="font-mono font-semibold">HNSPC-260804-VVGT</span>.
                </>
              ) : (
                <>
                  Tidak ada quotation dengan kode{" "}
                  <span className="font-mono font-semibold text-foreground">{shown}</span>.
                  Periksa lagi penulisannya pada dokumen — huruf O dan angka 0 mudah
                  tertukar.
                </>
              )}
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                href="/verify"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Coba kode lain
              </Link>
              <Link
                href="/build-pc"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Rakit PC baru
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default async function VerifyQuotePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const requestedCode = decodeURIComponent(code).trim().toUpperCase()

  // Kode yang formatnya jelas salah tidak perlu menyentuh database sama sekali.
  if (!QUOTE_CODE_PATTERN.test(requestedCode)) {
    return <QuoteNotFound code={requestedCode} malformed />
  }

  const quote = await getQuoteByCode(requestedCode)

  if (!quote) return <QuoteNotFound code={requestedCode} malformed={false} />

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

  // `assemblyFee` TIDAK ditambahkan lagi di sini. Untuk quotation baru nilainya
  // 0 (jasa rakit sudah jadi baris item tersendiri), sedangkan untuk quotation
  // lama `subtotal` sudah memuatnya — menjumlahkannya sekali lagi membuat total
  // harga terkini lebih mahal dari yang seharusnya.
  const currentTotal = rows.reduce(
    (acc, r) => acc + (r.currentPrice ?? r.price) * r.quantity,
    0
  )

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
                    {/* Opsi varian yang dipilih. Dokumen penawaran yang tidak
                        menyebutkannya tidak bisa diverifikasi terhadap barang
                        yang sebenarnya dipesan. Quotation lama tidak
                        memilikinya dan tampil apa adanya. */}
                    {row.variationLabel && (
                      <p className="mt-0.5 text-xs font-bold text-sale-red">
                        {row.variationLabel}
                      </p>
                    )}
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

            {/* Tanpa baris "Jasa rakit" yang terpisah, subtotal selalu sama
                dengan total — jadi cukup satu baris saja. Jasa rakit sekarang
                muncul sebagai komponen biasa di daftar di atas. */}
            <div className="mt-5 space-y-1.5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between">
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
