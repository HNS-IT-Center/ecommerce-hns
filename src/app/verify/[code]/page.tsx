import Link from "next/link"
import { ArrowLeft, SearchX } from "lucide-react"

import { requirePageView } from "@/lib/auth"
import {
  getQuoteByCode,
  getQuoteProductsCurrentInfo,
  getQuoteStatusForCashier,
  type QuoteLineItem,
} from "@/lib/api/pc-build-quotes"
import { formatRupiah } from "@/lib/utils"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductImage } from "@/components/ui/product-image"
import { QUOTE_CODE_PATTERN, formatQuoteDateTime } from "../format"
import { CloseQuotationButton } from "../close-quotation-button"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Verifikasi Quotation",
  // Halaman ini berisi data transaksi pelanggan; jangan sampai terindeks.
  robots: { index: false, follow: false },
}

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
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />

      <main className="min-h-content flex-1 bg-muted/20 py-8">
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
  // Khusus kasir & admin (izin `verify`). Tanpa akses → beranda; lihat src/proxy.ts.
  const { izin } = await requirePageView("verify", { deniedRedirect: "/" })
  const { bisaAkses } = await import("@/lib/auth/permissions")
  const bolehClosing = bisaAkses(izin, "verify", "edit")

  const { code } = await params
  const requestedCode = decodeURIComponent(code).trim().toUpperCase()

  // Kode yang formatnya jelas salah tidak perlu menyentuh database sama sekali.
  if (!QUOTE_CODE_PATTERN.test(requestedCode)) {
    return <QuoteNotFound code={requestedCode} malformed />
  }

  const [quote, info] = await Promise.all([
    getQuoteByCode(requestedCode),
    getQuoteStatusForCashier(requestedCode),
  ])

  if (!quote) return <QuoteNotFound code={requestedCode} malformed={false} />

  const terjual = info?.status === "closing"

  const items = quote.items as unknown as QuoteLineItem[]

  // Harga terkini untuk dibandingkan dengan snapshot saat quotation dibuat,
  // sekaligus gambar cadangan untuk quotation lama yang belum menyimpannya.
  const currentById = await getQuoteProductsCurrentInfo(items.map((i) => i.productId))

  const rows = items.map((item) => {
    const current = currentById.get(item.productId)
    const currentPrice = current?.price ?? null
    return {
      ...item,
      // Gambar di snapshot didahulukan: itulah yang tercetak di dokumen yang
      // dipegang pelanggan. Gambar produk terkini hanya mengisi yang kosong
      // (varian, lalu induknya).
      image: item.image || current?.image || null,
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
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />

      <main className="min-h-content flex-1 bg-muted/20 py-8">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          {/* Link biasa, bukan `router.back()`: kasir sering membuka halaman ini
              langsung dari hasil scan/URL, sehingga tidak ada riwayat untuk
              kembali. */}
          <Link
            href="/verify"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar
          </Link>

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
              <div className="flex flex-col items-end gap-1.5">
                <div className="rounded-full bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green">
                  ✓ Asli
                </div>
                {/* Status jual dipisah dari tanda keaslian: "asli" menjawab
                    apakah dokumennya benar terbit dari sistem, "terjual"
                    menjawab apakah ia sudah dipakai bertransaksi. Menggabungkan
                    keduanya jadi satu lencana membuat kasir menebak. */}
                {info && (
                  <div
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      terjual
                        ? "bg-brand-green text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {terjual ? "TERJUAL" : "Belum terjual"}
                    {info.revision > 1 && ` · Rev. ${info.revision}`}
                  </div>
                )}
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

            {/* Identitas yang BOLEH dilihat kasir: nama pelanggan (untuk
                mencocokkan orang di depan meja) dan nama sales. Nomor HP dan
                catatan internal sengaja tidak ikut — lihat
                `getQuoteStatusForCashier`. */}
            {(info?.customerName || info?.salesName) && (
              <dl className="mt-5 grid gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                {info.customerName && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Pelanggan</dt>
                    <dd className="font-semibold">{info.customerName}</dd>
                  </div>
                )}
                {info.salesName && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Sales</dt>
                    <dd className="font-semibold">{info.salesName}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* Riwayat revisi. Kasir perlu melihatnya untuk menjawab pelanggan
                yang membawa cetakan LAMA dari kode yang sama: angkanya berbeda
                bukan karena ada yang keliru, melainkan karena sudah direvisi. */}
            {info && info.revisions.length > 1 && (
              <div className="mt-5 rounded-xl border border-border p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Riwayat Revisi
                </p>
                <ul className="mt-2 divide-y divide-border">
                  {info.revisions.map((rev) => (
                    <li
                      key={rev.revision}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    >
                      <span>
                        <strong>Rev. {rev.revision}</strong>
                        {rev.revision === info.revision && (
                          <span className="ml-1.5 rounded bg-brand-green/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-green">
                            BERLAKU
                          </span>
                        )}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatQuoteDateTime(rev.createdAt)} · {rev.itemCount} item
                          {rev.usedLatestPrices ? " · harga terbaru" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold">{formatRupiah(Number(rev.total))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ul className="mt-5 divide-y divide-border">
              {rows.map((row, idx) => (
                <li key={`${row.productId}-${idx}`} className="flex gap-3 py-3">
                  <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground">
                    {idx + 1}
                  </span>
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                    <ProductImage
                      src={row.image}
                      // Kosong dengan sengaja: nama produknya tertulis tepat di
                      // sebelah kotak ini (lihat catatan di ProductImage).
                      alt=""
                      fill
                      sizes="48px"
                      className="object-contain p-0.5"
                    />
                  </div>
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
                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-sale-red">
                      {formatRupiah(row.price)} &times; {row.quantity}
                    </p>
                    {row.changed && row.currentPrice !== null && (
                      <p className="mt-0.5 text-xs font-semibold text-warning-foreground">
                        Harga terkini: {formatRupiah(row.currentPrice)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-sale-red">
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

            {/* Hanya kasir berizin `edit`, dan hanya selama belum terjual.
                Syarat yang sama ditegakkan ulang di dalam server action. */}
            {info && bolehClosing && !terjual && (
              <CloseQuotationButton
                code={quote.code}
                revision={info.revision}
                customerName={info.customerName}
                total={Number(quote.total)}
              />
            )}

            {terjual && info?.closedAt && (
              <p className="mt-4 rounded-xl border border-brand-green/30 bg-brand-green/10 px-4 py-3 text-sm text-brand-green">
                Sudah ditandai terjual pada {formatQuoteDateTime(info.closedAt)}.
              </p>
            )}
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
