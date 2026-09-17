import { notFound, redirect } from "next/navigation"

import { env } from "@/config/env"
import { PrintClientComponent } from "@/components/print/print-client-component"
import { PrintQr } from "@/features/pc-prebuild/components/print-qr"
import { fpsLevel, type FpsLevel } from "@/features/pc-prebuild/lib/fps-tone"
import {
  chosenComponents,
  selectionFromPick,
  selectionPrice,
} from "@/features/pc-prebuild/lib/selection"
import { toPrebuildView } from "@/features/pc-prebuild/lib/to-view"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { getPcBuilderConfig } from "@/lib/pc-builder/config"
import { getPcPrebuildConfig, getPcPrebuildGames } from "@/lib/pc-prebuild/config"
import {
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  PREBUILD_RESOLUTION_TIERS,
  PREBUILD_USE_CASES,
  findFpsEntry,
} from "@/lib/pc-prebuild/performance"
import { formatDiscountEndDate } from "@/lib/pc-prebuild/discount"
import { resolvePrebuildPresets } from "@/lib/pc-prebuild/resolve"
import {
  INK_AMBER,
  INK_BLACK,
  INK_GRAY,
  INK_GREEN,
  INK_HAIRLINE,
  INK_NAVY,
  INK_RED,
  INK_TINT,
} from "@/lib/print/ink"
import { formatRupiah } from "@/lib/utils"
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
 * ## Satu tata letak untuk semua perangkat
 *
 * Tidak ada satu pun kelas responsif (`sm:`, `md:`) di dalam lembar. Lembar
 * dirender selebar A4 di layar mana pun, jadi PDF yang disimpan dari HP sama
 * persis dengan yang disimpan dari PC. Di layar sempit pratinjaunya digulir
 * menyamping; yang dicetak tidak terpengaruh.
 *
 * `<thead>` juga sengaja tidak dipakai: aturan cetak global memberi `thead th`
 * padding 12mm untuk tabel quotation yang bersambung antar halaman.
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

const TIER_LABELS = new Map(PREBUILD_RESOLUTION_TIERS.map((t) => [t.id, t]))
const USE_CASE_LABELS = new Map(PREBUILD_USE_CASES.map((u) => [u.id, u]))

/** Ambangnya dari `fps-tone.ts`, warnanya tinta cetak. */
const FPS_INK: Record<FpsLevel, string> = {
  high: INK_NAVY,
  smooth: INK_GREEN,
  playable: INK_AMBER,
  low: INK_RED,
}

/** Kapasitas lembar satu halaman — lihat `tataLetak` di badan halaman. */
const MUAT_KOMPONEN = 10
const MUAT_GAME = 8
const BATAS_KOMPONEN_RINGKASAN = 16

const QUALITY_SHORT: Record<(typeof PREBUILD_FPS_QUALITIES)[number], string> = {
  Low: "Low",
  Medium: "Med",
  High: "High",
}

export default async function PrebuildPrintPage({ params, searchParams }: Props) {
  const [{ id }, { pick }] = await Promise.all([params, searchParams])
  const config = await getPcPrebuildConfig()

  if (!config.enabled) redirect("/build-pc")
  const preset = config.presets.find((p) => p.id === id)
  if (!preset) notFound()

  const [steps, games, stockDisplayMode, siteUrl] = await Promise.all([
    getPcBuilderConfig(),
    getPcPrebuildGames(),
    getStockDisplayMode(),
    resolveSiteUrl(),
  ])
  const [resolved] = await resolvePrebuildPresets([preset], steps, stockDisplayMode)
  const view = toPrebuildView(resolved, steps)

  const selection = selectionFromPick(view, typeof pick === "string" ? pick : undefined)
  const dipilih = chosenComponents(view, selection)
  const harga = selectionPrice(view, selection)

  // Analisis dihitung untuk susunan BAWAAN (docs/11-pc-prebuild.md §9). Kalau
  // pelanggan menukar sesuatu, lembar ini mengatakannya — bukan diam-diam
  // mencetak angka yang berlaku untuk komponen lain.
  const bukanBawaan = dipilih.some(
    ({ component, option }) => component.branching && option !== component.options[0]
  )

  const performance = view.performance
  const tier = performance ? TIER_LABELS.get(performance.resolution.tier) : undefined
  const cocokUntuk = performance
    ? performance.useCases
        .filter((u) => USE_CASE_LABELS.has(u.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
    : []
  // Game yang tidak punya satu sel pun tidak dicetak sebagai baris kosong.
  const barisGame = performance
    ? games.filter((g) => performance.gaming.fps.some((f) => f.gameId === g.id))
    : []

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

  /**
   * Tata letak menurut banyaknya isi — ditentukan dari JUMLAH, bukan diukur.
   *
   * Lembar satu halaman diukur pas untuk 10 komponen + 8 game dengan sisa
   * sekitar 3mm (17 Sep 2026). Tiap baris komponen (2 kartu) memakan ±14mm dan
   * tiap game ±6,5mm, jadi satu tambahan saja sudah melempar kaki halaman
   * sendirian ke halaman 2 — hasil paling berantakan. Daripada menunggu itu
   * terjadi, lembarnya sengaja dipecah di tempat yang rapi:
   *
   * - `satu`            ≤ 10 komponen dan ≤ 8 game: semuanya di halaman 1.
   * - `tabel-lanjut`    lebih dari itu: ringkasan performa tetap di halaman 1,
   *                     tabel FPS pindah utuh ke halaman 2.
   * - `performa-lanjut` > 16 komponen: seluruh blok performa di halaman 2 —
   *                     grid komponennya sendiri sudah memakan sebagian besar
   *                     halaman 1.
   *
   * Halaman 1 selalu berakhir dengan S&K, jadi ia tetap utuh kalau cuma
   * halaman itu yang dikirim atau dicetak.
   */
  const tataLetak: "satu" | "tabel-lanjut" | "performa-lanjut" =
    !performance || (view.components.length <= MUAT_KOMPONEN && barisGame.length <= MUAT_GAME)
      ? "satu"
      : view.components.length > BATAS_KOMPONEN_RINGKASAN
        ? "performa-lanjut"
        : "tabel-lanjut"

  const judulPerforma = (
    <div
      className="mb-2.5 flex items-baseline justify-between border-b pb-1"
      style={{ borderColor: INK_BLACK, borderBottomWidth: "1.5px" }}
    >
      <h2 className="text-[10px] font-black uppercase tracking-[0.18em]">Estimasi Performa</h2>
      <span className="text-[9px]" style={{ color: INK_GRAY }}>
        Perkiraan, bukan hasil pengukuran
      </span>
    </div>
  )

  const ringkasanPerforma = performance ? (
    <div className="print-avoid-break grid grid-cols-[34mm_1fr_62mm] gap-4">
      {tier ? (
        <div
          className="flex flex-col items-center justify-center rounded-lg px-2 py-2 text-center text-white"
          style={{ backgroundColor: INK_NAVY }}
        >
          <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/70">
            Cocok di
          </span>
          <span className="text-[22px] font-black leading-none">{tier.label}</span>
          <span className="mt-1 text-[10px] font-bold">{performance.resolution.quality}</span>
        </div>
      ) : (
        <div />
      )}

      <div className="min-w-0 self-center">
        {performance.headline && (
          <p className="text-[10.5px] font-semibold leading-relaxed">{performance.headline}</p>
        )}
        {performance.gaming.note && (
          <p className="mt-1 text-[9px] leading-relaxed" style={{ color: INK_GRAY }}>
            {performance.gaming.note}
          </p>
        )}
        {bukanBawaan && (
          <p className="mt-1 text-[8.5px] font-semibold leading-relaxed" style={{ color: INK_RED }}>
            Estimasi dihitung untuk susunan bawaan paket; pilihan komponen pada lembar ini
            bisa memberi hasil sedikit berbeda.
          </p>
        )}
      </div>

      {cocokUntuk.length > 0 && (
        <div className="rounded-lg px-3 py-2" style={{ backgroundColor: INK_TINT }}>
          <p className="mb-1 text-[8px] font-black uppercase tracking-[0.16em]" style={{ color: INK_NAVY }}>
            Cocok untuk
          </p>
          <ul className="space-y-0.5">
            {cocokUntuk.map((u) => (
              <li key={u.id} className="grid grid-cols-[1fr_18mm_7mm] items-center gap-1.5">
                <span className="truncate text-[9px] font-semibold">
                  {USE_CASE_LABELS.get(u.id)?.label}
                </span>
                <span className="h-[2mm] overflow-hidden rounded-full bg-white">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, u.score))}%`, backgroundColor: INK_NAVY }}
                  />
                </span>
                <span className="text-right text-[8.5px] font-bold">{u.score}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null

  const tabelFps = performance ? (
    <>
      {barisGame.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left">
          <colgroup>
            <col style={{ width: "38mm" }} />
            {PREBUILD_FPS_RESOLUTIONS.flatMap((r) =>
              PREBUILD_FPS_QUALITIES.map((q) => <col key={`${r}-${q}`} />)
            )}
          </colgroup>
          <tbody>
            <tr className="text-white" style={{ backgroundColor: INK_NAVY }}>
              <td rowSpan={2} className="px-2 py-1 text-[8.5px] font-black uppercase tracking-[0.14em]">
                Game
              </td>
              {PREBUILD_FPS_RESOLUTIONS.map((r) => (
                <td
                  key={r}
                  colSpan={PREBUILD_FPS_QUALITIES.length}
                  className="border-l border-white/30 py-1 text-center text-[9.5px] font-black"
                >
                  {r}
                </td>
              ))}
            </tr>
            <tr style={{ backgroundColor: INK_TINT, color: INK_NAVY }}>
              {PREBUILD_FPS_RESOLUTIONS.flatMap((r) =>
                PREBUILD_FPS_QUALITIES.map((q, i) => (
                  <td
                    key={`${r}-${q}`}
                    className="py-0.5 text-center text-[7.5px] font-bold uppercase tracking-wide"
                    style={i === 0 ? { borderLeft: `1px solid ${INK_HAIRLINE}` } : undefined}
                  >
                    {QUALITY_SHORT[q]}
                  </td>
                ))
              )}
            </tr>

            {barisGame.map((game) => (
              <tr key={game.id} className="print-avoid-break border-b" style={{ borderColor: INK_HAIRLINE }}>
                <td className="px-2 py-[0.3mm] text-[9px] font-bold leading-tight">{game.name}</td>
                {PREBUILD_FPS_RESOLUTIONS.flatMap((r) =>
                  PREBUILD_FPS_QUALITIES.map((q, i) => {
                    const sel = findFpsEntry(performance.gaming.fps, game.id, r, q)
                    return (
                      <td
                        key={`${r}-${q}`}
                        className="py-[0.3mm] text-center leading-none"
                        style={i === 0 ? { borderLeft: `1px solid ${INK_HAIRLINE}` } : undefined}
                      >
                        {sel ? (
                          <>
                            <span
                              className="block text-[10px] font-black"
                              style={{ color: FPS_INK[fpsLevel(sel.avg)] }}
                            >
                              {sel.avg}
                            </span>
                            <span className="block text-[6.5px]" style={{ color: INK_GRAY }}>
                              {sel.low}
                            </span>
                          </>
                        ) : (
                          <span className="text-[9px]" style={{ color: INK_HAIRLINE }}>
                            —
                          </span>
                        )}
                      </td>
                    )
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[7.5px]" style={{ color: INK_GRAY }}>
        <span>Angka besar = FPS rata-rata, kecil = 1% low.</span>
        <Legenda warna={FPS_INK.high} teks="≥ 100" />
        <Legenda warna={FPS_INK.smooth} teks="60–99 mulus" />
        <Legenda warna={FPS_INK.playable} teks="30–59 layak" />
        <Legenda warna={FPS_INK.low} teks="< 30" />
        <span className="basis-full leading-snug">
          Perkiraan kasar, bukan hasil pengukuran — hasil sebenarnya bergantung pada versi game,
          setelan grafis rinci (ray tracing, DLSS/FSR), driver, layar, dan suhu ruangan. Punya
          target FPS tertentu? Konsultasikan dengan kami sebelum memesan.
        </span>
      </div>
    </>
  ) : null

  const kaki = (
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
  )

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
              // Dijepit enam baris supaya ringkasan yang panjang tidak mendorong
              // performa dan kaki halaman ke lembar kedua. Teks lengkapnya ada
              // di halaman paket, satu pindaian QR dari sini.
              <p className="mt-1 line-clamp-6 text-[9.5px] leading-snug" style={{ color: INK_GRAY }}>
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

            <div className="grid grid-cols-2 gap-1.5">
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
                          <p className="line-clamp-2 text-[9px] font-bold leading-snug">{option.name}</p>
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

        {/* ---------- Performa + kaki, menurut `tataLetak` ---------- */}
        {tataLetak !== "performa-lanjut" && performance && (
          <section className="px-8 pt-4">
            {judulPerforma}
            {ringkasanPerforma}
            {tataLetak === "satu" && tabelFps}
          </section>
        )}

        {kaki}

        {tataLetak !== "satu" && performance && (
          <HalamanLanjutan nama={view.name}>
            <section className="px-8">
              {tataLetak === "performa-lanjut" ? (
                <>
                  {judulPerforma}
                  {ringkasanPerforma}
                </>
              ) : (
                <div
                  className="mb-1 flex items-baseline justify-between border-b pb-1"
                  style={{ borderColor: INK_BLACK, borderBottomWidth: "1.5px" }}
                >
                  <h2 className="text-[10px] font-black uppercase tracking-[0.18em]">
                    Perkiraan FPS per Game
                  </h2>
                  <span className="text-[9px]" style={{ color: INK_GRAY }}>
                    Perkiraan, bukan hasil pengukuran
                  </span>
                </div>
              )}
              {tabelFps}
            </section>
          </HalamanLanjutan>
        )}
      </div>
    </div>
  )
}

function Legenda({ warna, teks }: { warna: string; teks: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-[2mm] w-[2mm] rounded-full" style={{ backgroundColor: warna }} />
      {teks}
    </span>
  )
}

/**
 * Halaman kedua lembar cetak.
 *
 * `break-before: page` memulai kertas baru. Padding atas 12mm WAJIB di sini:
 * `@page` bermargin 0 dan padding `.print-sheet` hanya berlaku di potongan
 * pertama, jadi tanpa ini halaman 2 menempel ke tepi atas kertas.
 *
 * Di layar, pemisah bertanda "Halaman 2" menggantikan batas kertas yang tidak
 * terlihat — tanpa itu pratinjau terbaca sebagai satu halaman panjang.
 */
function HalamanLanjutan({ nama, children }: { nama: string; children: React.ReactNode }) {
  return (
    <div className="break-before-page print:pt-[12mm]">
      <div className="flex items-center gap-3 bg-neutral-100 py-3 print:hidden">
        <span className="h-px flex-1 border-t border-dashed border-neutral-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
          Halaman 2
        </span>
        <span className="h-px flex-1 border-t border-dashed border-neutral-400" />
      </div>
      <div
        className="mb-4 flex items-center justify-between px-8 py-2 text-white"
        style={{ backgroundColor: INK_NAVY }}
      >
        <span className="truncate text-[11px] font-black uppercase tracking-tight">{nama}</span>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Lanjutan · Halaman 2
        </span>
      </div>
      {children}
    </div>
  )
}
