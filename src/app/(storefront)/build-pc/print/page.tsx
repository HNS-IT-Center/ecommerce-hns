import Link from "next/link"

import {
  getPcBuilderConfig,
  getPcBuilderDisplayConfig,
} from "@/lib/pc-builder/config"
import { formatRupiah } from "@/lib/utils"
import {
  getQuoteByCode,
  getQuoteProductsCurrentInfo,
  publicTokenMatchesCode,
  type QuoteLineItem,
} from "@/lib/api/pc-build-quotes"
import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { QUOTE_CODE_PATTERN, formatQuoteDateLong } from "@/app/verify/format"
import { env } from "@/config/env"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { formatWhatsAppNumber } from "@/lib/utils/whatsapp-number"
import { INK_BLACK, INK_GRAY, INK_HAIRLINE, INK_NAVY, INK_RED } from "@/lib/print/ink"
import { PrintClientComponent } from "@/components/print/print-client-component"

export const metadata = {
  title: "Quotation Rakitan PC",
  /**
   * Halaman ini memuat nama pelanggan dan seluruh harganya. Ia tidak pernah
   * pantas muncul di hasil pencarian — dan sampai 23 September 2026 ia memang
   * bisa, karena tidak ada satu pun aturan crawler yang menyebutnya.
   */
  robots: { index: false, follow: false },
}

/**
 * Halaman ini HANYA MEMBACA.
 *
 * Sampai 21 September 2026 ia juga yang menerbitkan quotation: membuka
 * `?items=…` membaca katalog lalu menulis baris baru. Itu berarti setiap
 * refresh, setiap pra-render, dan setiap bot yang menelusuri tautan ikut
 * menulis — kebiasaan yang bisa ditolerir selagi kodenya hash, tapi tidak lagi
 * sejak kodenya nomor urut: refresh akan memakan nomor.
 *
 * Sekarang penerbitan ada di `features/builder/actions-quotation.ts`, dan
 * halaman ini merender `?kode=` yang sudah tersimpan. Konsekuensi yang
 * disengaja: **membuka ulang alamat yang sama selalu memberi dokumen yang sama
 * persis**, sampai ke rupiahnya — itulah yang membuat PDF di tangan pelanggan
 * bisa dipertanggungjawabkan.
 *
 * Yang dirender adalah SNAPSHOT di `pc_build_quotes.items`, bukan katalog hari
 * ini. Harga yang sudah dicetak tidak boleh berubah sendiri di belakang
 * pemiliknya; perbandingan dengan harga terkini adalah tugas `/verify/[code]`.
 */

/**
 * Penjaga akses halaman cetak. Token diperiksa LEBIH DULU karena ia tidak
 * menyentuh cookie sama sekali — pelanggan yang membuka tautannya tidak perlu
 * membayar pembacaan sesi yang pasti kosong, dan halaman ini tetap bisa dibuka
 * dari peramban yang memblokir cookie pihak ketiga.
 */
async function bolehBukaCetakan(kode: string, token: string): Promise<boolean> {
  if (token && (await publicTokenMatchesCode(kode, token))) return true

  const user = await getCurrentUser()
  if (!user) return false

  const izin = await muatIzinUser(user)
  return (
    bisaAkses(izin, "quotation-terbit", "edit") || bisaAkses(izin, "verify", "view")
  )
}

function ErrorState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="max-w-md text-center">
        <p className="text-lg font-bold text-black">Quotation tidak dapat dibuka</p>
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export default async function PrintPcBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const kode = typeof params.kode === "string" ? params.kode.trim().toUpperCase() : ""

  /**
   * Tautan lama `?items=…` tidak lagi menerbitkan apa pun.
   *
   * Menerbitkan dari isi URL berarti menghidupkan kembali persis jalur yang
   * ditutup: alamat yang bisa disalin, di-refresh, dan ditelusuri bot, yang
   * setiap kali memakan satu nomor. Alamat semacam itu juga tidak pernah jadi
   * dokumen yang stabil — ia merender ulang dari katalog setiap dibuka, jadi
   * tidak ada yang hilang dengan mengarahkan orang kembali ke builder.
   */
  if (!kode) {
    if (typeof params.items === "string" && params.items.length > 0) {
      return (
        <ErrorState
          message="Tautan cetak versi lama sudah tidak berlaku. Buka lagi rakitan Anda di halaman Rakit PC, lalu tekan Print untuk menerbitkan quotation bernomor."
          action={
            <Link
              href="/build-pc"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              Buka Rakit PC
            </Link>
          }
        />
      )
    }
    return <ErrorState message="Tidak ada kode quotation yang dikirim." />
  }

  if (!QUOTE_CODE_PATTERN.test(kode)) {
    return <ErrorState message="Format kode quotation tidak dikenali." />
  }

  /**
   * Siapa yang boleh membuka dokumen ini.
   *
   * Sampai 23 September 2026 jawabannya "siapa saja yang tahu kodenya" — dan
   * sejak kodenya jadi NOMOR URUT (`HNSPC-20260921-0001`), tahu satu kode
   * berarti tahu semuanya: naik-turunkan angka terakhirnya dan seluruh
   * penawaran bulan itu terbuka, lengkap dengan nama pelanggannya.
   *
   * Sekarang ada dua jalan masuk, dan keduanya disengaja:
   *
   *  1. **Sesi staff** dengan izin `quotation-terbit` (sales & CS yang mencetak
   *     ulang dari riwayatnya) atau `verify` (kasir yang mencocokkan dokumen di
   *     meja). Mereka membuka `?kode=` saja, seperti sebelumnya.
   *  2. **`?t=<token>`** yang cocok dengan kodenya — untuk pelanggan, yang
   *     tidak punya sesi apa pun. Token itu sampai ke tangan mereka lewat
   *     tautan penawaran, atau langsung dari tombol Print di builder yang
   *     menerimanya dari hasil penerbitan.
   *
   * Akibat yang diterima sadar: bookmark `?kode=` lama milik PENGUNJUNG anonim
   * berhenti bekerja. Yang tercetak di dalam PDF adalah `/verify/<kode>`, bukan
   * alamat ini, jadi dokumen yang sudah beredar tidak terpengaruh.
   */
  const token = typeof params.t === "string" ? params.t.trim().toLowerCase() : ""
  const bolehLihat = await bolehBukaCetakan(kode, token)
  if (!bolehLihat) {
    return (
      <ErrorState
        message="Tautan ini tidak lengkap. Buka lewat tautan penawaran yang dikirim sales Anda, atau hubungi HNS IT Center untuk dikirimkan ulang."
        action={
          <Link
            href="/build-pc"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Buka Rakit PC
          </Link>
        }
      />
    )
  }

  const quote = await getQuoteByCode(kode)
  if (!quote) {
    return <ErrorState message={`Quotation ${kode} tidak ditemukan.`} />
  }

  /**
   * `items` bertipe Json di Prisma, jadi bentuknya tidak dijamin tipe. Dibaca
   * lewat `unknown` dengan penjaga bentuk, bukan `as any` (CLAUDE.md §2.4) —
   * snapshot lama punya medan yang lebih sedikit daripada yang sekarang, dan
   * itu memang sah.
   */
  const snapshot: QuoteLineItem[] = Array.isArray(quote.items)
    ? (quote.items as unknown as QuoteLineItem[])
    : []

  if (snapshot.length === 0) {
    return <ErrorState message="Isi quotation ini kosong atau rusak." />
  }

  const [stepsConfig, displayConfig] = await Promise.all([
    getPcBuilderConfig(),
    getPcBuilderDisplayConfig(),
  ])

  const showItemPrices = displayConfig.showItemPrices

  /**
   * Cadangan gambar untuk snapshot lama.
   *
   * Medan `image` baru ada belakangan, jadi quotation yang dicetak sebelum itu
   * tidak memilikinya. Dikuerikan HANYA kalau memang ada yang kosong — dokumen
   * baru tidak perlu membayar kueri ini sama sekali.
   */
  const missingImages = snapshot.filter((item) => !item.image).map((item) => item.productId)
  const imageFallback =
    missingImages.length > 0 ? await getQuoteProductsCurrentInfo(missingImages) : null

  const lineItems = snapshot.map((item) => ({
    id: item.productId,
    name: item.name,
    parentName: item.parentName ?? null,
    variationLabel: item.variationLabel ?? null,
    sku: item.sku,
    image: item.image ?? imageFallback?.get(item.productId)?.image ?? undefined,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
    stepName: item.stepName ?? null,
  }))

  // Kelompokkan per kategori, urut sesuai urutan step di konfigurasi builder.
  const groups = new Map<string, typeof lineItems>()
  for (const item of lineItems) {
    const key = item.stepName ?? "Komponen Lainnya"
    const existing = groups.get(key)
    if (existing) existing.push(item)
    else groups.set(key, [item])
  }

  const stepOrder = new Map(stepsConfig.map((step, index) => [step.name, index]))
  const sortedGroups = Array.from(groups.entries()).sort(
    ([a], [b]) => (stepOrder.get(a) ?? 999) - (stepOrder.get(b) ?? 999)
  )

  // Nomor urut dihitung di depan supaya penomoran tetap berurutan lintas grup
  // tanpa memutasi variabel saat render.
  let numbered = 0
  const orderedGroups = sortedGroups.map(([groupName, groupItems]) => ({
    groupName,
    groupItems: groupItems.map((item) => ({ ...item, index: ++numbered })),
  }))

  /**
   * Angka diambil dari baris quotation, bukan dijumlah ulang dari snapshot.
   * Keduanya harus sama — dan kalau suatu hari tidak, yang berlaku adalah yang
   * tersimpan, karena itulah yang dilihat kasir di `/verify`.
   */
  const subtotal = Number(quote.subtotal)
  const total = Number(quote.total)
  const totalUnits = lineItems.reduce((acc, item) => acc + item.quantity, 0)

  /**
   * Tanggal TERBIT, bukan tanggal cetak, dan dikunci ke WIB.
   *
   * Dulu ini `new Date()` waktu server: cetak ulang bulan depan akan menampilkan
   * tanggal bulan depan pada dokumen yang diterbitkan hari ini — dua kertas
   * berkode sama dengan dua tanggal berbeda.
   */
  const issuedDate = formatQuoteDateLong(quote.createdAt)

  const quoteRef = quote.code
  const revision = quote.revision
  const customerName = quote.customerName
  const salesName = quote.salesName

  // Alamat mutlak: tautan di dalam PDF dibuka di luar browser (viewer HP,
  // WhatsApp), jadi path relatif tidak punya host untuk dituju. Lewat
  // `resolveSiteUrl()` supaya tidak jadi `0.0.0.0:3000` di balik proxy dan
  // tidak bisa diarahkan ke host palsu lewat header `Host`.
  const siteUrl = await resolveSiteUrl()

  return (
    <div className="min-h-screen bg-neutral-100 py-8 print:bg-white print:py-0">
      <PrintClientComponent />

      <div
        className="print-sheet mx-auto w-full max-w-[210mm] bg-white shadow-xl print:max-w-none print:shadow-none"
        style={{ color: INK_BLACK }}
      >
        {/* ---------- Header ---------- */}
        <header
          className="flex items-start justify-between gap-6 px-8 py-6 text-white print:px-7 print:py-5"
          style={{ backgroundColor: INK_NAVY }}
        >
          <div>
            {/* <img> biasa, bukan next/image: optimizer melakukan lazy-load &
                transformasi yang kerap belum selesai saat dialog cetak dibuka,
                sehingga logo/thumbnail tercetak sebagai kotak abu-abu. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/Logo HNS IT Center.png"
              alt="HNS IT Center"
              className="mb-2 h-10 w-auto object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <p className="max-w-[72mm] text-[10px] leading-snug text-white/75">
              Pusat IT &amp; Gaming terpercaya di Batam. Harga terbaik, garansi resmi,
              teknisi berpengalaman.
            </p>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-black uppercase leading-none tracking-tight">
              Quotation
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
              Rakitan PC
            </p>
            <dl className="mt-2.5 space-y-1 text-[11px]">
              <div className="flex items-baseline justify-end gap-2">
                <dt className="text-white/60">No.</dt>
                <dd className="font-mono font-semibold tracking-tight">
                  {/* Tautan ke halaman verifikasi kasir. Kasir yang
                      berizin langsung melihat rinciannya; pengunjung lain
                      (termasuk pelanggan pemilik PDF ini) diantar ke beranda
                      oleh src/proxy.ts. Gayanya sengaja tidak seperti tautan
                      — dokumen resmi, bukan halaman web. */}
                  <a
                    href={`${siteUrl}/verify/${quoteRef}`}
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {quoteRef}
                  </a>
                  {/* Nomor revisi hanya muncul kalau memang pernah direvisi.
                      Menuliskan "Rev. 1" pada dokumen yang tidak punya riwayat
                      justru menimbulkan pertanyaan yang tidak perlu di kasir. */}
                  {revision > 1 && (
                    <span className="ml-2 font-sans font-bold">Rev. {revision}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-baseline justify-end gap-2">
                <dt className="text-white/60">Tanggal</dt>
                <dd className="font-semibold">{issuedDate}</dd>
              </div>
              {/* Pelanggan & Sales hanya untuk quotation yang diterbitkan staff
                  atas nama seseorang. Cetakan pengunjung tetap anonim seperti
                  sebelumnya — tidak ada baris kosong yang tercetak.
                  Nomor HP dan catatan internal TIDAK PERNAH masuk ke sini. */}
              {customerName && (
                <div className="flex items-baseline justify-end gap-2">
                  <dt className="text-white/60">Pelanggan</dt>
                  <dd className="font-semibold">{customerName}</dd>
                </div>
              )}
              {salesName && (
                <div className="flex items-baseline justify-end gap-2">
                  <dt className="text-white/60">Sales</dt>
                  <dd className="font-semibold">{salesName}</dd>
                </div>
              )}
            </dl>
          </div>
        </header>

        {/* ---------- Item list ---------- */}
        <main className="px-8 py-6 print:px-7 print:py-5">
          <div
            className="mb-2 flex items-baseline justify-between border-b pb-1"
            style={{ borderColor: INK_BLACK, borderBottomWidth: "1.5px" }}
          >
            <h2 className="text-[11px] font-black uppercase tracking-[0.18em]">
              Rincian Komponen
            </h2>
            <span className="text-[11px] font-semibold" style={{ color: INK_GRAY }}>
              {lineItems.length} item &middot; {totalUnits} unit
            </span>
          </div>

          {/* Tabel tunggal untuk semua grup: kolom Qty/Harga/Subtotal sejajar
              rapi lintas kategori, dan tidak ada jarak besar antar kategori. */}
          <table className="print-table w-full border-collapse text-left">
            <colgroup>
              <col style={{ width: "7mm" }} />
              {/* Muat thumbnail 100px (≈26.5mm) + jarak ke kolom nama. */}
              <col style={{ width: "30mm" }} />
              <col />
              <col style={{ width: "12mm" }} />
              {showItemPrices && <col style={{ width: "26mm" }} />}
              {showItemPrices && <col style={{ width: "28mm" }} />}
            </colgroup>

            <thead>
              <tr className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: INK_GRAY }}>
                <th className="pb-1.5 pt-1 font-black">#</th>
                <th className="pb-1.5 pt-1 font-black" />
                <th className="pb-1.5 pt-1 font-black">Komponen</th>
                <th className="pb-1.5 pt-1 text-center font-black">Qty</th>
                {showItemPrices && (
                  <th className="pb-1.5 pt-1 text-right font-black">Harga</th>
                )}
                {showItemPrices && (
                  <th className="pb-1.5 pt-1 text-right font-black">Subtotal</th>
                )}
              </tr>
            </thead>

            {orderedGroups.map(({ groupName, groupItems }) => (
              <tbody key={groupName} className="print-avoid-break">
                <tr>
                  <td
                    colSpan={showItemPrices ? 6 : 4}
                    className="pb-1 pt-2.5 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ color: INK_NAVY }}
                  >
                    {groupName}
                  </td>
                </tr>

                {groupItems.map((item) => (
                  <tr
                    key={`${groupName}-${item.id}`}
                    className="print-avoid-break border-t align-middle"
                    style={{ borderColor: INK_HAIRLINE }}
                  >
                    <td
                      className="py-2 pr-1 align-middle font-mono text-[10px] font-semibold"
                      style={{ color: INK_GRAY }}
                    >
                      {item.index}
                    </td>

                    <td className="py-2 pr-2.5 align-middle">
                      <div
                        className="flex items-center justify-center overflow-hidden rounded border bg-white"
                        style={{ borderColor: INK_HAIRLINE, height: "100px", width: "100px" }}
                      >
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[8px] font-bold uppercase" style={{ color: INK_HAIRLINE }}>
                            N/A
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Nama panjang membungkus ke bawah, tidak dipotong. */}
                    <td className="py-2 pr-2.5 align-middle">
                      <p className="text-[11.5px] font-bold leading-snug">{item.name}</p>
                      {item.variationLabel && (
                        <p className="mt-0.5 text-[10px] font-bold leading-none" style={{ color: INK_RED }}>
                          {item.variationLabel}
                        </p>
                      )}
                      {item.sku && (
                        <p className="mt-0.5 text-[9px] leading-none" style={{ color: INK_GRAY }}>
                          SKU {item.sku}
                        </p>
                      )}
                    </td>

                    <td
                      className="py-2 text-center align-middle text-[11.5px] font-bold"
                      style={{ color: INK_BLACK }}
                    >
                      {item.quantity}
                    </td>

                    {showItemPrices && (
                      <td
                        className="py-2 text-right align-middle text-[11px] font-semibold"
                        style={{ color: INK_RED }}
                      >
                        {formatRupiah(item.price)}
                      </td>
                    )}

                    {showItemPrices && (
                      <td
                        className="py-2 text-right align-middle text-[11.5px] font-black"
                        style={{ color: INK_RED }}
                      >
                        {formatRupiah(item.subtotal)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>

        </main>

        {/* Total + footer dijadikan satu blok `print-avoid-break`: keduanya
            harus berpindah bersama ke halaman berikutnya, bukan terbelah di
            tengah (mis. total tertinggal di halaman 1, S&K terlempar sendirian
            ke halaman 2). */}
        <div className="print-avoid-break">
          {/* ---------- Total ---------- */}
          <div className="flex justify-end px-8 pb-5 print:px-7 print:pb-4">
            <div className="w-full max-w-[84mm]">
              {showItemPrices && (
                <div
                  className="flex items-baseline justify-between border-t py-1.5 text-[11px]"
                  style={{ borderColor: INK_HAIRLINE }}
                >
                  <span style={{ color: INK_GRAY }}>Subtotal komponen</span>
                  <span className="font-semibold">{formatRupiah(subtotal)}</span>
                </div>
              )}
              <div
                className="mt-2 flex items-baseline justify-between rounded px-4 py-2.5 text-white"
                style={{ backgroundColor: INK_NAVY }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">Total</span>
                <span className="text-lg font-black">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>

          {/* ---------- Footer ---------- */}
          <footer
            className="border-t px-8 py-5 print:px-7 print:py-4"
            style={{ borderColor: INK_HAIRLINE }}
          >
            <div className="grid grid-cols-[1fr_auto] gap-8">
              <div>
                <p
                  className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.15em]"
                  style={{ color: INK_GRAY }}
                >
                  Syarat &amp; Ketentuan
                </p>
                <ul className="space-y-0.5 text-[9.5px] leading-snug" style={{ color: INK_GRAY }}>
                  <li>Harga dapat berubah sewaktu-waktu tanpa pemberitahuan sebelumnya.</li>
                  <li>Stok &amp; Harga tidak mengikat sebelum ada pembayaran lunas atau DP.</li>
                  <li className="font-semibold" style={{ color: INK_BLACK }}>
                    Harga yang berlaku adalah harga pada sistem saat transaksi.
                  </li>
                </ul>
              </div>

              <div className="text-right">
                <p
                  className="mb-1.5 text-[9.5px] font-black uppercase tracking-[0.15em]"
                  style={{ color: INK_GRAY }}
                >
                  Hubungi Kami
                </p>
                <p className="text-[10.5px] font-bold">HNS IT Center Batam</p>
                <p className="mt-0.5 text-[9.5px] leading-snug" style={{ color: INK_GRAY }}>
                  WhatsApp {formatWhatsAppNumber(env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER)}
                  <br />
                  Batam, Kepulauan Riau
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
