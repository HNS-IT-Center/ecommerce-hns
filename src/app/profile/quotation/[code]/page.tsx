import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, PencilLine, Printer } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { getQuotationForUser } from "@/lib/api/pc-build-quotes"
import { formatRupiah } from "@/lib/utils"
import { QUOTE_CODE_PATTERN, formatQuoteDateTime } from "@/app/verify/format"

export const metadata = {
  title: "Detail Quotation",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Detail satu quotation milik staff.
 *
 * Di sinilah nomor HP tampil UTUH — berbeda dengan daftar, yang menyamarkannya.
 * Bedanya disengaja: daftar dibuka sambil lalu dan sering terlihat orang lain
 * yang kebetulan lewat di depan layar kasir, sedangkan halaman ini dibuka
 * dengan niat menindaklanjuti satu pelanggan tertentu.
 *
 * Kasir TIDAK pernah melihat halaman ini; `/verify/[code]` punya tampilannya
 * sendiri tanpa nomor HP dan tanpa catatan internal.
 */
export default async function DetailQuotationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect("/login?next=/profile/quotation")

  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "quotation-terbit", "edit")) redirect("/profile")

  const { code: raw } = await params
  const code = decodeURIComponent(raw).trim().toUpperCase()
  if (!QUOTE_CODE_PATTERN.test(code)) notFound()

  /**
   * `null` bisa berarti dua hal — kodenya tidak ada, atau bukan milik orang ini
   * — dan keduanya sengaja berakhir di halaman yang sama. Membedakannya
   * mengubah halaman ini jadi alat untuk menebak kode quotation orang lain.
   */
  const quote = await getQuotationForUser(code, user.id)
  if (!quote) notFound()

  const terjual = quote.status === "closing"

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      <main className="flex-1 p-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <Link
            href="/profile/quotation"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar
          </Link>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex flex-wrap items-center gap-2 font-mono text-lg font-bold">
                  {quote.code}
                  {quote.revision > 1 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground">
                      Rev. {quote.revision}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold ${
                      terjual ? "bg-brand-green/15 text-brand-green" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {terjual ? "Terjual" : "Terbit"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Diterbitkan {formatQuoteDateTime(quote.createdAt)}
                  {quote.closedAt && ` · Ditandai terjual ${formatQuoteDateTime(quote.closedAt)}`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/build-pc/print?kode=${encodeURIComponent(quote.code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <Printer className="h-4 w-4" />
                  Cetak ulang
                </Link>

                {/* Hanya pemilik, dan hanya selama belum ditandai terjual.
                    Syarat yang sama ditegakkan ulang di server — tombol yang
                    hilang bukan pengamanan, ia cuma tombol yang hilang. */}
                {quote.isOwner && !terjual && (
                  <Link
                    href={`/build-pc?quotation=${encodeURIComponent(quote.code)}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PencilLine className="h-4 w-4" />
                    Revisi di Builder
                  </Link>
                )}
              </div>
            </div>

            {quote.dioperDariCs && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                Dioper dari CS{quote.dioperOleh ? ` · ${quote.dioperOleh}` : ""}
              </p>
            )}
            {!quote.isOwner && (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Anda menerbitkan quotation ini lalu mengopernya. Hak revisi ada pada Sales
                pemegangnya.
              </p>
            )}
          </div>

          {/* Identitas pelanggan — lengkap, termasuk nomor HP & catatan internal. */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Pelanggan</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Baris label="Nama" value={quote.customerName ?? "—"} />
              <Baris label="Nomor HP" value={quote.customerPhone ?? "—"} />
              <Baris label="Sales" value={quote.salesName ?? "—"} />
            </dl>
            {quote.internalNote && (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Catatan internal — tidak tercetak di PDF
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{quote.internalNote}</p>
              </div>
            )}
          </section>

          {/* Isi revisi terakhir. Angkanya dari snapshot, bukan katalog hari ini. */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold">Rincian Komponen</h2>
            <ul className="mt-3 divide-y divide-border">
              {quote.items.map((item, i) => (
                <li key={`${item.productId}-${i}`} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.stepName ?? "Komponen Lainnya"}
                      {item.variationLabel ? ` · ${item.variationLabel}` : ""}
                      {item.quantity > 1 ? ` · ${item.quantity}×` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatRupiah(item.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
              <span className="text-sm font-bold">Total</span>
              <span className="text-lg font-extrabold">{formatRupiah(quote.total)}</span>
            </div>
          </section>

          {/* Riwayat revisi selalu memuat Rev. 1, karena ia ditulis bersamaan
              dengan penerbitan — bukan baru saat revisi pertama terjadi. */}
          {quote.revisions.length > 1 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-bold">Riwayat Revisi</h2>
              <ul className="mt-3 divide-y divide-border">
                {quote.revisions.map((rev) => (
                  <li key={rev.revision} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold">Rev. {rev.revision}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatQuoteDateTime(rev.createdAt)} · {rev.itemCount} item
                        {rev.usedLatestPrices ? " · harga katalog terbaru" : ""}
                      </p>
                    </div>
                    <p className="font-semibold">{formatRupiah(rev.total)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {quote.statusLogs.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-bold">Riwayat Status</h2>
              <ul className="mt-3 divide-y divide-border">
                {quote.statusLogs.map((log, i) => (
                  <li key={i} className="py-2.5 text-sm">
                    <p className="font-semibold">
                      {log.fromStatus} → {log.toStatus}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatQuoteDateTime(log.createdAt)}
                      {log.reason ? ` · ${log.reason}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
