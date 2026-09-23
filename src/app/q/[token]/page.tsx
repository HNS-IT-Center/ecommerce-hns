import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock, Download, MessageCircle } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductImage } from "@/components/ui/product-image"
import { env } from "@/config/env"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { buildPublicContactTarget } from "@/features/quotation/lib/public-contact"
import { getQuoteByPublicToken } from "@/lib/api/pc-build-quotes"
import { getPcBuilderConfig, getPcBuilderDisplayConfig } from "@/lib/pc-builder/config"
import { PUBLIC_TOKEN_PATTERN } from "@/lib/utils/public-token"
import { formatRupiah } from "@/lib/utils"
import { formatQuoteDateLong } from "@/app/verify/format"

/**
 * Penawaran rakitan PC seperti yang dibaca PELANGGAN — alamat pendek
 * `hnsitcenter.id/q/k3f9m2qa` yang diselipkan sales di pesan follow-up.
 *
 * Bukan halaman cetak, dan sengaja tidak mirip: yang dibuka di WhatsApp dari
 * layar HP tidak butuh kertas A4 berkop surat, ia butuh satu layar yang bisa
 * digulir untuk mengingat kembali "tadi saya pilih apa saja, totalnya berapa".
 *
 * Tiga hal yang menentukan bentuk halaman ini, dan ketiganya jangan dibongkar
 * tanpa membaca docs/17 §12:
 *
 *  1. **Alamatnya token acak, bukan `code`.** Kode quotation berurutan, jadi
 *     satu tautan yang beredar akan jadi pintu ke seluruh penawaran bulan itu.
 *  2. **Nomor HP dan catatan internal tidak pernah sampai ke sini** — dijaga
 *     oleh `getQuoteByPublicToken()` yang memang tidak meng-`select` keduanya.
 *  3. **Tidak ada satu pun harga yang dihitung ulang dari katalog.** Yang
 *     tampil adalah snapshot revisi terakhir, sama persis dengan yang dilihat
 *     kasir di `/verify` (CLAUDE.md §2.7).
 */

export const dynamic = "force-dynamic"

/**
 * Metadata SENGAJA statis dan tanpa satu pun data pelanggan.
 *
 * WhatsApp mengambil kartu pratinjau dari `og:title`/`og:description` dan
 * menampilkannya di setiap percakapan tempat tautannya diteruskan — termasuk
 * grup. Judul dinamis "Penawaran Budi — Rp 24.500.000" berarti nama dan nilai
 * transaksi seseorang terbaca tanpa siapa pun perlu membuka tautannya.
 *
 * `index: false` bukan pengganti token: ia mencegah halaman ini muncul di hasil
 * pencarian, bukan mencegah orang membukanya.
 */
export const metadata = {
  title: "Penawaran Rakitan PC — HNS IT Center",
  description: "Rincian penawaran rakitan PC dari HNS IT Center Batam.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Penawaran Rakitan PC — HNS IT Center",
    description: "Buka untuk melihat rincian rakitan dan totalnya.",
  },
}

/**
 * Umur penawaran sebelum halaman ini berhenti menyebutnya harga yang berlaku.
 *
 * Tautan ini abadi — pelanggan bisa membukanya delapan bulan kemudian dari
 * riwayat chat, dan tanpa peringatan ia akan mengira angkanya masih berlaku.
 * Harga komponen PC bergerak bulanan, jadi tiga puluh hari adalah batas yang
 * masih bisa dipertanggungjawabkan toko di depan orang yang datang membawa
 * layar HP-nya.
 */
const HARI_KEDALUWARSA = 30

export default async function PenawaranPublikPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token: raw } = await params
  const token = decodeURIComponent(raw).trim().toLowerCase()

  // Alamat yang jelas bukan token tidak perlu menyentuh database sama sekali.
  if (!PUBLIC_TOKEN_PATTERN.test(token)) notFound()

  const quote = await getQuoteByPublicToken(token)

  /**
   * Token yang tidak ketemu berakhir di 404 biasa — TIDAK seperti `/verify`,
   * yang sengaja menampilkan kodenya kembali supaya kasir bisa mencocokkan
   * salah ketik. Di sini tidak ada yang mengetik: tautannya ditekan, bukan
   * disalin. Halaman yang menjelaskan "token tidak ditemukan" hanya berguna
   * bagi orang yang sedang menebak-nebak.
   */
  if (!quote) notFound()

  const [stepsConfig, displayConfig] = await Promise.all([
    getPcBuilderConfig(),
    getPcBuilderDisplayConfig(),
  ])

  const terjual = quote.status === "closing"
  const kedaluwarsa = quote.umurHari > HARI_KEDALUWARSA

  // Dikelompokkan per kategori mengikuti urutan step di builder, sama seperti
  // PDF-nya — supaya yang dibaca di layar dan yang dipegang di kertas punya
  // susunan yang sama saat keduanya dibandingkan berdampingan.
  const stepOrder = new Map(stepsConfig.map((step, index) => [step.name, index]))
  const groups = new Map<string, typeof quote.items>()
  for (const item of quote.items) {
    const key = item.stepName ?? "Komponen Lainnya"
    const existing = groups.get(key)
    if (existing) existing.push(item)
    else groups.set(key, [item])
  }
  const orderedGroups = Array.from(groups.entries()).sort(
    ([a], [b]) => (stepOrder.get(a) ?? 999) - (stepOrder.get(b) ?? 999)
  )

  /**
   * Tujuan tombol WhatsApp: sales yang melayani, atau CS sebagai jaring
   * terakhir kalau nomor sales belum diisi. Aturannya di `buildPublicContactTarget`.
   */
  const kontak = buildPublicContactTarget({
    code: quote.code,
    revision: quote.revision,
    customerName: quote.customerName,
    salesName: quote.salesName,
    salesPhone: quote.salesPhone,
    csNumber: env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
  })

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />

      <main className="min-h-content flex-1 bg-muted/20 py-6 sm:py-10">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          {/* ---------- Kepala dokumen ---------- */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Penawaran Rakitan PC
            </p>
            <h1 className="mt-1 font-mono text-xl font-extrabold tracking-tight sm:text-2xl">
              {quote.code}
              {quote.revision > 1 && (
                <span className="ml-2 font-sans text-sm font-semibold text-muted-foreground">
                  Rev. {quote.revision}
                </span>
              )}
            </h1>

            {quote.customerName && (
              <p className="mt-2 text-sm">
                Untuk <strong className="font-semibold">{quote.customerName}</strong>
                {quote.salesName && (
                  <>
                    {" · Sales "}
                    <strong className="font-semibold">{quote.salesName}</strong>
                  </>
                )}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {terjual && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2.5 py-1 text-xs font-semibold text-brand-green">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sudah diproses
                </span>
              )}
              {quote.sudahDp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  DP diterima
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                Harga per {formatQuoteDateLong(quote.pricedAt)}
              </span>
            </div>

            {/* Peringatan umur, bukan penghalang. Angkanya tetap ditampilkan —
                yang membuka tautan ini ingin mengingat rakitannya, dan
                menyembunyikan totalnya justru memaksa ia bertanya hal yang
                sudah pernah dijawab. */}
            {kedaluwarsa && !terjual && (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                Penawaran ini dibuat <strong>{quote.umurHari} hari</strong> yang lalu. Harga komponen
                bisa sudah berubah — hubungi sales kami untuk memastikan harga terbaru sebelum
                memesan.
              </p>
            )}
          </section>

          {/* ---------- Rincian komponen ---------- */}
          <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-bold">Rincian Komponen</h2>
              <span className="text-xs text-muted-foreground">{quote.itemCount} item</span>
            </div>

            <div className="mt-4 space-y-5">
              {orderedGroups.map(([groupName, groupItems]) => (
                <div key={groupName}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {groupName}
                  </p>
                  <ul className="mt-2 divide-y divide-border">
                    {groupItems.map((item, i) => (
                      <li key={`${item.productId}-${i}`} className="flex items-start gap-3 py-3">
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                          <ProductImage
                            src={item.image}
                            alt={item.name}
                            width={48}
                            height={48}
                            className="h-full w-full object-contain"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">{item.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.variationLabel ? `${item.variationLabel} · ` : ""}
                            {item.quantity}×
                          </p>
                        </div>

                        {displayConfig.showItemPrices && (
                          <p className="shrink-0 text-sm font-semibold">
                            {formatRupiah(item.price * item.quantity)}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-bold">Total</span>
              <span className="text-xl font-extrabold">{formatRupiah(quote.total)}</span>
            </div>
          </section>

          {/* ---------- Tindakan ---------- */}
          <section className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href={buildWhatsAppUrl(kontak.number, kontak.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-3 text-sm font-bold text-white transition-colors hover:brightness-95"
            >
              <MessageCircle className="h-4 w-4" />
              {kontak.keCs || !quote.salesName
                ? "Tanya via WhatsApp"
                : `Tanya ${quote.salesName} via WhatsApp`}
            </a>

            {/* Halaman cetak dibuka dengan token yang sama — pemegang tautan ini
                memang berhak atas dokumennya, dan tanpa `t=` ia akan ditolak
                karena pelanggan tidak punya sesi staff. */}
            <a
              href={`/build-pc/print?kode=${encodeURIComponent(quote.code)}&t=${token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-input px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Download className="h-4 w-4" />
              Buka versi PDF
            </a>
          </section>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Penawaran ini diterbitkan {formatQuoteDateLong(quote.createdAt)} oleh HNS IT Center
            Batam. Ada yang ingin diubah?{" "}
            <Link href="/build-pc" className="font-semibold text-primary hover:underline">
              Rakit ulang di sini
            </Link>
            .
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
