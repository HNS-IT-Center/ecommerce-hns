import { notFound, redirect } from "next/navigation"

import { env } from "@/config/env"
import { PrintClientComponent } from "@/components/print/print-client-component"
import { PrintQr } from "@/features/pc-prebuild/components/print-qr"
import {
  chosenComponents,
  selectionFromPick,
  selectionPrice,
} from "@/features/pc-prebuild/lib/selection"
import { toPrebuildView } from "@/features/pc-prebuild/lib/to-view"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig } from "@/lib/pc-prebuild/config"
import { formatDiscountEndDate } from "@/lib/pc-prebuild/discount"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"
import {
  INK_BLACK,
  INK_GRAY,
  INK_GREEN,
  INK_HAIRLINE,
  INK_NAVY,
  INK_RED,
} from "@/lib/print/ink"
import { formatRupiah } from "@/lib/utils"
import { stripHtml } from "@/lib/utils/html"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { formatWhatsAppNumber } from "@/lib/utils/whatsapp-number"

/**
 * Lembar spesifikasi PC Prebuild — dicetak browser jadi PDF.
 *
 * Sengaja BERBEDA dari quotation `/build-pc/print`, dan bedanya bukan cuma
 * tampilan:
 *
 * - **Tidak dicatat** ke `recordPcBuildQuote` dan tidak punya nomor verifikasi.
 *   Ini brosur paket yang boleh beredar bebas, bukan penawaran harga yang
 *   dipegang kasir.
 * - **Harga per komponen tidak dicetak** — hanya harga paket. Alasannya sama
 *   dengan halaman paket (docs/11-pc-prebuild.md §11): harga satuan mengundang
 *   pelanggan menjumlahkan sendiri lalu menawar selisihnya.
 *
 * ## Harga
 *
 * Dibaca ulang dari katalog setiap kali halaman ini dibuka, lewat
 * `resolvePrebuildPresets` dan `selectionPrice` yang SAMA dengan halaman paket —
 * jadi angka di PDF selalu sama dengan angka di layar saat tombolnya ditekan.
 * Dari URL yang diambil hanya id paket dan pilihan tukarnya (`?pick=`), dan
 * pilihan yang bukan tawaran staff diabaikan.
 *
 * ## Isi lembar (25 September 2026)
 *
 * Blok **Estimasi Performa** — kotak resolusi, bar "Cocok untuk", dan matriks
 * FPS 3×3 per game — sudah TIDAK dicetak di lembar ini. Keputusan pemilik
 * produk: brosur yang dibagikan ke pelanggan cukup membawa isi paket, harga,
 * dan uraian yang ditulis staff sendiri. Panelnya tidak dihapus dari project —
 * ia tetap hidup di halaman paket `/pc-prebuild/<id>`, dan `performancePublic`
 * tetap dihitung seperti biasa.
 *
 * Yang menggantikannya di bawah: `preset.performanceDescription`, uraian
 * rich-text yang ditulis staff di panel admin KHUSUS untuk lembar ini
 * (docs/11-pc-prebuild.md §15). Ia bukan `summary` — `summary` tetap di kolom
 * kanan sebagai satu-dua kalimat "paket ini untuk siapa".
 *
 * Karena blok performa pergi, lembar tidak lagi memilih tata letak satu atau
 * dua halaman di depan (`tataLetak` yang lama, beserta ambang 10 komponen /
 * 8 game): yang tersisa mengalir apa adanya dan nyaris selalu muat satu
 * halaman. Konsekuensinya jujur — deskripsi yang sangat panjang bisa menyeret
 * kaki halaman ke lembar kedua, dan halaman kedua itu tidak punya jarak ke
 * tepi atas kertas (`@page` bermargin 0; padding `.print-sheet` hanya berlaku
 * di potongan pertama).
 *
 * ## Satu tata letak untuk semua perangkat
 *
 * Tidak ada satu pun kelas responsif (`sm:`, `md:`) di dalam lembar. Lembar
 * dirender selebar A4 di layar mana pun, jadi PDF yang disimpan dari HP sama
 * persis dengan yang disimpan dari PC. Di layar sempit pratinjaunya digulir
 * menyamping; yang dicetak tidak terpengaruh.
 */

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ pick?: string | string[] }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const config = await getPcPrebuildConfig()
  const preset = config.enabled ? config.presets.find((p) => p.id === id) : undefined
  return {
    title: preset ? `Spesifikasi ${preset.name}` : "Spesifikasi PC Prebuild",
    // Lembar cetak bukan halaman untuk ditemukan lewat pencarian — halaman
    // paketnya yang diindeks.
    robots: { index: false, follow: false },
  }
}

export default async function PrebuildPrintPage({ params, searchParams }: Props) {
  const [{ id }, { pick }] = await Promise.all([params, searchParams])
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")
  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

  const [steps, stockDisplayMode, siteUrl] = await Promise.all([
    getPcBuilderConfig(),
    getStockDisplayMode(),
    resolveSiteUrl(),
  ])
  const [resolved] = await resolvePrebuildPresets([preset], steps, stockDisplayMode)
  const view = toPrebuildView(resolved, steps)

  const selection = selectionFromPick(view, typeof pick === "string" ? pick : undefined)
  const dipilih = chosenComponents(view, selection)
  const harga = selectionPrice(view, selection)

  // Deskripsi PDF ditulis staff sebagai rich text. Yang diperiksa TEKSNYA,
  // bukan panjang HTML-nya: editor menyisakan "<p></p>" untuk kolom yang
  // pernah disentuh lalu dikosongkan lagi, dan judul yang berdiri di atas
  // paragraf kosong lebih buruk daripada tidak ada blok sama sekali.
  const deskripsi = preset.performanceDescription?.trim() ?? ""
  const adaDeskripsi = stripHtml(deskripsi).length > 0

  const pageUrl = `${siteUrl}/pc-prebuild/${encodeURIComponent(view.id)}`
  const sekarang = new Date()
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(sekarang)
  const hariTanggal = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(sekarang)

  return (
    <div className="min-h-screen overflow-x-auto bg-neutral-100 py-8 print:overflow-visible print:bg-white print:py-0">
      <PrintClientComponent backHref={`/pc-prebuild/${encodeURIComponent(view.id)}`} backLabel="Kembali ke paket" />

      <div
        className="print-sheet mx-auto w-[210mm] min-w-[210mm] bg-white shadow-xl print:w-full print:min-w-0 print:shadow-none"
        style={{ color: INK_BLACK }}
      >
        {/* ---------- Kepala ---------- */}
        <header
          className="flex items-center justify-between gap-6 px-8 py-3 text-white"
          style={{ backgroundColor: INK_NAVY }}
        >
          {/* <img> biasa, bukan next/image — lihat catatan di /build-pc/print. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/Logo HNS IT Center.png"
            alt="HNS IT Center"
            className="h-8 w-auto object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/70">
                Spesifikasi Paket
              </p>
              <p className="text-xl font-black uppercase leading-tight tracking-tight">PC Rakitan</p>
              <p className="mt-0.5 text-[10px] text-white/70">{tanggal}</p>
            </div>
            {/* QR di kepala, bukan di kaki: kaki halaman yang tertinggi adalah
                yang pertama terlempar ke halaman 2 saat ringkasan paketnya
                panjang. Latar putih wajib — QR terang-di-gelap tidak terbaca
                sebagian besar pemindai. */}
            <a
              href={pageUrl}
              aria-label="Buka halaman paket"
              className="block rounded bg-white p-[1mm]"
              title="Pindai untuk harga terbaru"
            >
              <span className="block h-[15mm] w-[15mm]">
                <PrintQr value={pageUrl} color={INK_BLACK} />
              </span>
            </a>
          </div>
        </header>

        {/* ---------- Foto + identitas + komponen ---------- */}
        <section className="grid grid-cols-[62mm_1fr] gap-6 px-8 pt-5">
          <div className="space-y-3">
            <div
              className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-white"
              style={{ borderColor: INK_HAIRLINE }}
            >
              {view.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={view.cover} alt={view.name} className="h-full w-full object-contain p-2" />
              ) : (
                <span className="text-[9px] font-bold uppercase" style={{ color: INK_GRAY }}>
                  Foto belum tersedia
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border-2" style={{ borderColor: INK_NAVY }}>
              <p
                className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white"
                style={{ backgroundColor: INK_NAVY }}
              >
                Harga Paket
              </p>
              <div className="px-3 py-2.5">
                {harga.discount > 0 && (
                  <>
                    <p className="text-[10px] line-through" style={{ color: INK_GRAY }}>
                      {formatRupiah(harga.normal)}
                    </p>
                    <p className="text-[9.5px] font-bold" style={{ color: INK_GREEN }}>
                      Potongan paket {formatRupiah(harga.discount)}
                    </p>
                  </>
                )}
                <p className="text-[19px] font-black leading-tight" style={{ color: INK_RED }}>
                  {formatRupiah(harga.final)}
                </p>
                {/* Tanggal lembar ini dibuat — harga dibaca dari katalog saat
                    itu juga, dan berkas PDF-nya tidak ikut berubah sesudahnya. */}
                <p className="mt-0.5 text-[8.5px] font-semibold" style={{ color: INK_BLACK }}>
                  Harga berlaku per {hariTanggal}
                </p>
                {view.discountEndsAt && harga.discount > 0 && (
                  <p className="mt-0.5 text-[8.5px]" style={{ color: INK_GRAY }}>
                    Potongan berlaku s.d. {formatDiscountEndDate(view.discountEndsAt)}
                  </p>
                )}
                {view.missingCount > 0 && (
                  <p className="mt-1 text-[8.5px] font-semibold" style={{ color: INK_RED }}>
                    Sebagian — {view.missingCount} komponen sedang tidak tersedia
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: INK_NAVY }}>
              PC Prebuild HNS IT Center
            </p>
            <h1 className="mt-1 text-[22px] font-black leading-tight tracking-tight">{view.name}</h1>
            {view.summary && (
              // Dulu dijepit enam baris supaya tidak mendorong blok performa ke
              // lembar kedua. Blok itu sudah tidak ada, jadi ringkasannya
              // dicetak utuh — kalimat yang putus di tengah ("…pendingin
              // DeepC…") membuat brosur terbaca seperti halaman yang gagal
              // dimuat.
              <p className="mt-1 text-justify text-[9.5px] leading-snug hyphens-auto" style={{ color: INK_GRAY }}>
                {view.summary}
              </p>
            )}

            <div
              className="mb-1.5 mt-3 flex items-baseline justify-between border-b pb-1"
              style={{ borderColor: INK_BLACK, borderBottomWidth: "1.5px" }}
            >
              <h2 className="text-[10px] font-black uppercase tracking-[0.18em]">Isi Paket</h2>
              <span className="text-[9.5px] font-semibold" style={{ color: INK_GRAY }}>
                {view.components.length} komponen
              </span>
            </div>

            {/* Nama produk dicetak UTUH — tidak ada `line-clamp` di sini.
                Sebelumnya dijepit dua baris demi memuat blok performa di
                halaman yang sama, dan yang terpotong justru bagian yang
                membedakan satu barang dari barang lain: kapasitas SSD, ukuran
                RAM, tipe motherboard. Pelanggan yang memegang brosur terpotong
                tetap harus bertanya ke CS untuk tahu apa yang ia beli.

                Semua kartu SETINGGI kartu tertinggi (`auto-rows-fr`), isinya
                di tengah secara vertikal (`items-center`). Nama yang dicetak
                utuh membuat panjangnya berbeda-beda, dan kartu yang tingginya
                acak — baik rata atas maupun hanya disamakan per baris — membuat
                grid terlihat bergerigi (28 Sep 2026). Harganya: satu nama
                panjang meninggikan SEMUA kartu. */}
            <div className="grid auto-rows-fr grid-cols-2 gap-1.5">
              {view.components.map((component) => {
                const option = dipilih.find((c) => c.component.key === component.key)?.option
                const label =
                  component.role === "other" && component.stepName
                    ? component.stepName
                    : component.roleLabel

                return (
                  <div
                    key={component.key}
                    className="print-avoid-break flex items-center gap-2 rounded-md border px-1.5 py-1"
                    style={{ borderColor: INK_HAIRLINE }}
                  >
                    <div
                      className="flex h-[10mm] w-[10mm] shrink-0 items-center justify-center overflow-hidden rounded border bg-white"
                      style={{ borderColor: INK_HAIRLINE }}
                    >
                      {option?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={option.image} alt="" className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[7.5px] font-black uppercase tracking-[0.12em]"
                        style={{ color: INK_NAVY }}
                      >
                        {label}
                        {option && option.quantity > 1 ? ` · ${option.quantity} pcs` : ""}
                      </p>
                      {option ? (
                        <>
                          <p className="text-[9px] font-bold leading-snug">{option.name}</p>
                          {option.variationLabel && (
                            <p className="text-[8px] font-bold leading-tight" style={{ color: INK_RED }}>
                              {option.variationLabel}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[9px] font-semibold" style={{ color: INK_RED }}>
                          Sedang tidak tersedia
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ---------- Deskripsi dari staff ---------- */}
        {adaDeskripsi && (
          <section className="px-8 pt-4">
            <div
              className="mb-2 flex items-baseline justify-between break-after-avoid border-b pb-1"
              style={{ borderColor: INK_BLACK, borderBottomWidth: "1.5px" }}
            >
              <h2 className="text-[10px] font-black uppercase tracking-[0.18em]">Deskripsi Performa</h2>
              <span className="text-[9px]" style={{ color: INK_GRAY }}>
                Ditulis tim HNS IT Center
              </span>
            </div>

            {/* Isinya HTML dari editor rich-text panel admin — penulisnya staff
                yang sudah login, model kepercayaan yang sama dengan deskripsi
                produk di `product-tabs.tsx`.

                Kelas `prose` SENGAJA tidak dipakai: warnanya di `globals.css`
                diikat ke token tema (`var(--foreground)`), yang pada tema gelap
                berarti teks terang — di atas kertas putih itu tidak terbaca.
                Lembar cetak memakai tinta `lib/print/ink.ts` yang tidak ikut
                tema. */}
            <div
              className="text-[9.5px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_a]:underline [&_em]:italic [&_h2]:mb-1 [&_h2]:mt-2.5 [&_h2]:text-[11px] [&_h2]:font-black [&_h2]:uppercase [&_h2]:tracking-[0.12em] [&_h2]:text-[color:var(--tinta-navy)] [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[10px] [&_h3]:font-black [&_h3]:text-[color:var(--tinta-navy)] [&_li]:mb-0.5 [&_li]:leading-snug [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:my-1.5 [&_strong]:font-bold [&_table]:my-1.5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4"
              style={{ "--tinta-navy": INK_NAVY } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: deskripsi }}
            />
          </section>
        )}

        {/* ---------- Kaki ---------- */}
        <footer
          className="print-avoid-break mt-3 border-t px-8 py-2.5 text-[8px] leading-snug"
          style={{ borderColor: INK_HAIRLINE, color: INK_GRAY }}
        >
          <p>
            <span className="font-black uppercase tracking-[0.12em]">Syarat &amp; Ketentuan · </span>
            Harga per {tanggal}, dapat berubah sewaktu-waktu tanpa pemberitahuan. Stok &amp; harga
            tidak mengikat sebelum ada pembayaran lunas atau DP.{" "}
            <span className="font-semibold" style={{ color: INK_BLACK }}>
              Harga yang berlaku adalah harga pada sistem saat transaksi.
            </span>
          </p>
          <p className="mt-1">
            <span className="text-[9.5px] font-bold" style={{ color: INK_BLACK }}>
              HNS IT Center Batam
            </span>{" "}
            · WhatsApp {formatWhatsAppNumber(env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER)} · Batam, Kepulauan
            Riau · Pindai QR di kanan atas untuk harga terbaru
          </p>
        </footer>
      </div>
    </div>
  )
}
