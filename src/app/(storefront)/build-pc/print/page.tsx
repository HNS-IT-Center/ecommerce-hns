import { getPrisma } from "@/lib/prisma/client"
import {
  getPcBuilderConfig,
  getPcBuilderDisplayConfig,
} from "@/app/admin/(panel)/pc-builder/actions"
import { formatRupiah } from "@/lib/utils"
import { recordPcBuildQuote } from "@/lib/api/pc-build-quotes"
import { env } from "@/config/env"
import { PrintClientComponent } from "./print-client-component"

/**
 * `6282169703377` → `+62 821-6970-3377`. Nomor di env disimpan polos (dipakai
 * apa adanya oleh wa.me), jadi format bacanya dibuat di sini khusus untuk
 * dicetak: 3 digit awal, lalu blok 4-an, sisanya digabung di blok terakhir.
 */
function formatWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw

  const local = digits.replace(/^62/, "").replace(/^0/, "")
  if (local.length < 6) return `+62 ${local}`

  const blocks = [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean)
  return `+62 ${blocks.join("-")}`
}

/**
 * Palet cetak. Nilai-nilai ini dipilih supaya konversi ke CMYK oleh driver
 * printer/PDF menghasilkan warna pekat tanpa "hijau kotor" atau abu-abu bernoda:
 * setiap warna sengaja memakai kanal RGB yang murni/ekstrem.
 *
 * - INK_NAVY  ≈ C100 M85 Y30 K25  (biru korporat, tanpa campuran merah berlebih)
 * - INK_RED   ≈ C0  M100 Y100 K0  (merah proses, aman untuk harga)
 * - INK_BLACK ≈ K100              (teks utama; hitam murni, bukan rich black)
 */
const INK_NAVY = "#0d2959"
const INK_RED = "#d81f26"
const INK_BLACK = "#000000"
const INK_GRAY = "#6b7280"
const INK_HAIRLINE = "#d4d4d4"

export const metadata = {
  title: "Quotation Rakitan PC - HNS IT Center",
}

/** Batas wajar kuantitas per item — URL bisa diedit bebas oleh siapa saja. */
const MAX_QUANTITY_PER_ITEM = 99
const MAX_ITEMS = 60

type ParsedItem = {
  stepId: string | null
  productId: number
  quantity: number
}

/**
 * Format `items`: `stepId:productId:qty` dipisah koma. Format lama
 * (`productId:qty`) tetap diterima supaya tautan yang sudah tersebar tidak rusak
 * — bedanya hanya item tidak terkelompok per kategori.
 *
 * Yang diambil dari URL HANYA id & kuantitas. Nama produk, harga, dan gambar
 * selalu dibaca ulang dari database, jadi mengubah harga lewat inspect element
 * di halaman builder tidak berpengaruh apa-apa pada dokumen ini.
 */
function parseItemsParam(raw: string): ParsedItem[] {
  return raw
    .split(",")
    .slice(0, MAX_ITEMS)
    .map((chunk) => {
      const parts = chunk.split(":")
      const [stepId, productId, quantity] =
        parts.length >= 3 ? parts : [null, parts[0], parts[1]]

      return {
        stepId: stepId || null,
        productId: Number(productId),
        quantity: Number(quantity),
      }
    })
    .filter(
      (item) => Number.isInteger(item.productId) && item.productId > 0 && Number.isFinite(item.quantity)
    )
    .map((item) => ({
      ...item,
      // Clamp: `?items=5:-999` atau `5:1e9` tidak boleh membuat total ngawur.
      quantity: Math.min(Math.max(Math.trunc(item.quantity), 1), MAX_QUANTITY_PER_ITEM),
    }))
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8">
      <div className="max-w-md text-center">
        <p className="text-lg font-bold text-black">Quotation tidak dapat dibuat</p>
        <p className="mt-2 text-sm text-neutral-600">{message}</p>
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
  const itemsParam = typeof params.items === "string" ? params.items : ""

  if (!itemsParam) {
    return <ErrorState message="Tidak ada data komponen yang dikirim." />
  }

  const items = parseItemsParam(itemsParam)
  if (items.length === 0) {
    return <ErrorState message="Format data komponen tidak valid." />
  }

  const prisma = getPrisma()
  const [products, stepsConfig, displayConfig] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: {
        id: true,
        name: true,
        sku: true,
        regularPrice: true,
        salePrice: true,
        images: {
          orderBy: { position: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    }),
    getPcBuilderConfig(),
    getPcBuilderDisplayConfig(),
  ])

  const showItemPrices = displayConfig.showItemPrices

  // Nama kategori diambil dari konfigurasi di database, bukan dari URL — URL
  // hanya menyumbang stepId-nya.
  const stepNameById = new Map(stepsConfig.map((step) => [step.id, step.name]))

  const lineItems = items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId)
      if (!product) return null

      const salePrice = product.salePrice ? Number(product.salePrice) : 0
      const regularPrice = product.regularPrice ? Number(product.regularPrice) : 0
      const price = salePrice > 0 ? salePrice : regularPrice

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        image: product.images[0]?.url,
        price,
        quantity: item.quantity,
        subtotal: price * item.quantity,
        stepName: item.stepId ? stepNameById.get(item.stepId) ?? null : null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (lineItems.length === 0) {
    return <ErrorState message="Komponen yang dipilih tidak ditemukan di katalog." />
  }

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

  // Jasa rakit tidak lagi ditambahkan di sini: biayanya dikonfigurasi sebagai
  // step tersendiri di PC Builder, jadi sudah ikut terhitung di `lineItems`.
  const subtotal = lineItems.reduce((acc, item) => acc + item.subtotal, 0)
  const total = subtotal
  const totalUnits = lineItems.reduce((acc, item) => acc + item.quantity, 0)

  const now = new Date()
  const issuedDate = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  // Catat quotation supaya bisa diverifikasi lewat /q/[code]. Pencatatan yang
  // gagal tidak boleh menggagalkan pencetakan — pelanggan tetap harus dapat
  // dokumennya, cuma tanpa kode verifikasi.
  let quoteRef: string | null = null
  try {
    const recorded = await recordPcBuildQuote(
      lineItems.map((item) => ({
        productId: item.id,
        name: item.name,
        sku: item.sku,
        image: item.image,
        price: item.price,
        quantity: item.quantity,
        stepName: item.stepName,
      }))
    )
    quoteRef = recorded.code
  } catch (error) {
    console.error("[build-pc/print] gagal mencatat quotation:", error)
  }

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
              {quoteRef && (
                <div className="flex items-baseline justify-end gap-2">
                  <dt className="text-white/60">No.</dt>
                  <dd className="font-mono font-semibold tracking-tight">{quoteRef}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-end gap-2">
                <dt className="text-white/60">Tanggal</dt>
                <dd className="font-semibold">{issuedDate}</dd>
              </div>
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
                      {item.sku && (
                        <p className="mt-0.5 text-[9px] leading-none" style={{ color: INK_GRAY }}>
                          SKU {item.sku}
                        </p>
                      )}
                    </td>

                    <td
                      className="py-2 text-center align-middle text-[11.5px] font-bold tabular-nums"
                      style={{ color: INK_BLACK }}
                    >
                      {item.quantity}
                    </td>

                    {showItemPrices && (
                      <td
                        className="py-2 text-right align-middle text-[11px] font-semibold tabular-nums"
                        style={{ color: INK_RED }}
                      >
                        {formatRupiah(item.price)}
                      </td>
                    )}

                    {showItemPrices && (
                      <td
                        className="py-2 text-right align-middle text-[11.5px] font-black tabular-nums"
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
                  <span className="font-semibold tabular-nums">{formatRupiah(subtotal)}</span>
                </div>
              )}
              <div
                className="mt-2 flex items-baseline justify-between rounded px-4 py-2.5 text-white"
                style={{ backgroundColor: INK_NAVY }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">Total</span>
                <span className="text-lg font-black tabular-nums">{formatRupiah(total)}</span>
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
                  <li>Jasa rakit sudah termasuk instalasi sistem operasi standar.</li>
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
