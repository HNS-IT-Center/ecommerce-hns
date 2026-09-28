"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { ArrowRight, ChevronLeft, ChevronRight, ImageOff, TriangleAlert } from "lucide-react"

import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import {
  findFpsEntry,
  PREBUILD_FPS_QUALITIES,
  PREBUILD_FPS_RESOLUTIONS,
  type PrebuildFpsQuality,
  type PrebuildFpsResolution,
} from "@/lib/pc-prebuild/performance"
import { formatRupiah } from "@/lib/utils"

import { packagePrice } from "../lib/selection"
import { ProductImage } from "@/components/ui/product-image"

import { COMPONENT_ROLE_ICONS } from "../lib/component-icons"
import { fpsTone } from "../lib/fps-tone"
import type { PrebuildView } from "../lib/types"
import { GameMark } from "./game-mark"
import { UseCaseChips } from "./use-cases"

/**
 * Satu kartu paket, dua sisi.
 *
 * Sisi depan menjawab "isinya apa", sisi belakang menjawab "sanggup apa" —
 * dua pertanyaan yang sama-sama diajukan pembeli, dan yang tidak muat
 * bersamaan di satu kartu tanpa salah satunya jadi terlalu ringkas untuk
 * berguna.
 *
 * ## Kenapa geser, bukan dua kartu bersebelahan
 *
 * Keduanya menerangkan paket yang SAMA. Dua kartu terpisah membuat pelanggan
 * membandingkan sisi belakang paket A dengan sisi depan paket B, padahal yang
 * ingin ia bandingkan adalah paketnya.
 *
 * ## Gesernya memakai scroll-snap, BUKAN drag framer-motion
 *
 * Versi pertama memakai `motion.div` ber-`drag="x"` dengan
 * `dragConstraints={{ left: 0, right: 0 }}`, sementara posisi sisinya diatur
 * `animate={{ x: ... }}`. Dua kendali menulis satu nilai `x`, dan constraint-nya
 * mengunci nilai itu ke 0 — jadi begitu pelanggan yang sedang di sisi 2
 * MENYENTUH kartu (mis. hendak menggulir daftar game), framer menarik `x`
 * kembali ke 0 dan kartunya lompat ke sisi 1. Saat jarinya lepas tanpa melewati
 * ambang, `sisi` tidak berubah, target `animate` juga tidak — jadi tidak ada
 * animasi balik dan tampilannya tertinggal di sisi 1 padahal indikatornya masih
 * "2/2". Roda tetikus aman karena roda tidak pernah memulai drag; yang kena
 * sentuhan, dan di ponsel itu berarti setiap usaha menggulir daftar FPS.
 *
 * Karena itu arbitrase sumbu sekarang diserahkan ke peramban: track-nya
 * container `overflow-x-auto` + `snap-x snap-mandatory`, tiap sisi
 * `w-full shrink-0 snap-start`. Gerakan vertikal di atas daftar menggulir
 * daftarnya, gerakan horizontal memindah sisi — peramban yang memutuskan, dan
 * ia tidak pernah salah memilih seperti drag yang diurus JS. Tombol panah
 * memanggil `scrollTo({ behavior: "smooth" })`, dan indikator "1/2" dibaca balik
 * dari `scrollLeft` lewat `onScroll` supaya posisinya cuma punya SATU sumber
 * kebenaran. Jangan kembalikan `drag`/`dragConstraints` ke sini.
 *
 * ## JANGAN pakai tautan yang menutupi seluruh kartu di sini
 *
 * Pola `<Link className="absolute inset-0 z-10">` yang dipakai deck admin TIDAK
 * bisa dipakai di kartu ini, dan pernah dicoba: tautan sebesar kartu berada di
 * atas isinya, jadi ia menelan setiap klik tombol filter dan setiap guliran di
 * daftar FPS. Menaikkan `z-index` isinya tidak menolong — waktu itu track-nya
 * `motion.div` yang menganimasikan `x`, dan `transform` **membuat stacking
 * context baru**, jadi seluruh `z-20` di dalam track jadi relatif terhadap
 * track-nya sendiri, bukan terhadap tautan di luar. Track sekarang bukan lagi
 * elemen ber-transform, tapi kesimpulannya tidak berubah: yang salah memang
 * bukan angkanya.
 *
 * Susunannya sekarang:
 *
 * - **Tautan sungguhannya ada di footer**, sebagai tombol "Lihat Detail" yang
 *   terlihat dan TIDAK ikut bergeser. Ia satu-satunya `<a>` di kartu ini: yang
 *   dapat fokus keyboard, yang bisa diklik-kanan untuk membuka tab baru, dan
 *   yang dibaca pembaca layar. Footer sengaja di luar track — begitu pelanggan
 *   sampai di sisi performa, ia tidak perlu menebak bagian mana yang membuka
 *   halaman.
 * - **Kedua sisi cuma pintasan tetikus.** Keduanya memakai `onClick` yang
 *   menuju alamat yang sama; ia kenyamanan tambahan, bukan jalur aksesibilitas —
 *   itu sudah dipegang tombol di footer. Karena itu isinya tetap `div`/`ul`
 *   biasa yang bisa dibaca pembaca layar, bukan dibungkus `<a>` kedua yang
 *   mengumumkan tautan kembar di setiap kartu.
 *
 * Geseran yang berakhir di atas sebuah sisi tidak boleh ikut membuka halaman —
 * lihat `baruGulir` di bawah.
 *
 * ## Tinggi kartu & foto sengaja dipatok per breakpoint
 *
 * Dulu fotonya `aspect-16/10`, jadi tingginya ikut melebar bersama kartunya —
 * dan di layar kecil (apalagi satu kolom, tempat kartunya justru paling lebar)
 * foto itu memakan ruang sampai daftar komponen tinggal 2–3 baris. Daftar yang
 * cuma memperlihatkan tiga baris tidak menjawab "isinya apa"; ia cuma memberi
 * tahu bahwa ada yang disembunyikan.
 *
 * Sekarang tinggi fotonya tetap per breakpoint (`object-contain`, jadi tidak ada
 * yang terpotong) dan tinggi kartunya dinaikkan, supaya sisa ruang untuk daftar
 * konsisten ±4–5 baris di semua ukuran layar. Kalau angkanya diubah, ubah
 * keduanya bersamaan — yang menentukan tinggi daftar adalah SELISIHNYA, bukan
 * salah satunya.
 */

type Props = {
  view: PrebuildView
  games: PrebuildGame[]
}

export function PrebuildCard({ view, games }: Props) {
  const router = useRouter()
  const trackRef = useRef<HTMLDivElement>(null)
  const [sisi, setSisi] = useState<0 | 1>(0)

  /**
   * Menandai bahwa yang baru saja terjadi adalah GULIRAN, bukan ketukan.
   *
   * Peramban memang sudah menahan `click` yang lahir dari panning sentuh, tapi
   * penanda ini menutup sisanya: ketukan yang mendarat saat guliran inersia
   * masih berjalan, dan ketukan yang menyusul guliran halus dari tombol panah.
   * Tanpa itu, sebagian usaha menggeser kartu berakhir di halaman detail.
   */
  const baruGulir = useRef(false)
  const jedaGulir = useRef<number | null>(null)

  const href = `/pc-prebuild/${encodeURIComponent(view.id)}`

  // Paket tanpa analisis yang tayang TIDAK punya sisi belakang. Sisi kosong
  // berisi "belum ada data" cuma memberi tahu pelanggan tentang pekerjaan
  // internal HNS yang bukan urusannya.
  const adaPerforma = view.performance !== null

  /** Dipakai tombol panah. Posisinya TIDAK di-set di sini — lihat `saatGulir`. */
  const keSisi = (tujuan: 0 | 1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: tujuan * track.clientWidth, behavior: "smooth" })
  }

  /**
   * Satu-satunya yang mengubah `sisi`.
   *
   * Tombol panah sengaja tidak ikut menyetelnya: kalau keduanya menulis, saat
   * guliran halus masih di tengah jalan indikatornya berkedip antara dua nilai.
   * Posisi sebenarnya ada di `scrollLeft`, jadi itu yang dibaca.
   */
  const saatGulir = () => {
    const track = trackRef.current
    if (!track) return

    setSisi(track.scrollLeft > track.clientWidth / 2 ? 1 : 0)

    baruGulir.current = true
    if (jedaGulir.current !== null) window.clearTimeout(jedaGulir.current)
    jedaGulir.current = window.setTimeout(() => {
      baruGulir.current = false
    }, 120)
  }

  /** Dipakai kedua sisi sebagai pintasan tetikus, dengan penjaga guliran. */
  const bukaDetail = () => {
    if (baruGulir.current) return
    router.push(href)
  }

  // Kartu paket bercabang berlabel "mulai dari", jadi potongannya dinilai
  // terhadap kombinasi termurah — angka yang memang sedang ditampilkan.
  const harga = packagePrice(view, view.branchingCount > 0 ? view.minTotal : view.total)

  return (
    // Hover-nya sengaja mencolok: kartu ini padat isi, dan tanpa perubahan yang
    // jelas tidak ada yang menandai bahwa seluruh kartunya memang bisa ditekan.
    // Naik sedikit + garis tepi hijau + bayangan tebal, ketiganya sekaligus —
    // bayangan saja nyaris tak terlihat di mode gelap.
    <article className="group flex h-140 min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-green/60 hover:shadow-xl xl:h-144">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* `no-scrollbar` menyembunyikan batangnya, BUKAN mematikan gulirannya
            — geseran sentuh dan trackpad tetap jalan, cuma tidak ada batang
            abu-abu yang memotong kartu. `overflow-y-hidden` supaya container
            ini tidak ikut menawarkan guliran vertikal; itu milik daftar di
            dalam masing-masing sisi. */}
        <div
          ref={trackRef}
          onScroll={saatGulir}
          className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
        >
          <SisiKomponen view={view} onOpen={bukaDetail} />
          {adaPerforma && <SisiPerforma view={view} games={games} onOpen={bukaDetail} />}
        </div>
      </div>

      {/* Footer TIDAK ikut bergeser — ia di luar track. Harga dan tombol
          "Lihat Detail" karena itu tetap di tempat yang sama di kedua sisi,
          jadi tidak ada saat di mana pelanggan harus menebak ke mana harus
          menekan. */}
      <footer className="shrink-0 space-y-3 border-t bg-card p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {view.branchingCount > 0 ? "Mulai dari" : "Harga paket"}
            </p>
            {harga.discount > 0 && (
              <p className="truncate text-xs text-muted-foreground line-through">
                {formatRupiah(harga.normal)}
              </p>
            )}
            <p className="truncate text-lg font-extrabold text-sale-red">
              {formatRupiah(harga.final)}
            </p>
          </div>

          {adaPerforma && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => keSisi(0)}
                disabled={sisi === 0}
                aria-label="Lihat komponen"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors enabled:hover:border-brand-green enabled:hover:text-brand-green disabled:cursor-default disabled:opacity-35"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                {sisi + 1}/2
              </span>
              <button
                type="button"
                onClick={() => keSisi(1)}
                disabled={sisi === 1}
                aria-label="Lihat estimasi performa"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border transition-colors enabled:hover:border-brand-green enabled:hover:text-brand-green disabled:cursor-default disabled:opacity-35"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Satu-satunya `<a>` di kartu ini. Ia ikut menyala saat kartunya
            di-hover, jadi terbaca sebagai "tekan di mana saja" tanpa kehilangan
            target yang jelas bagi yang mencarinya. */}
        <Link
          href={href}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border text-sm font-bold transition-colors group-hover:border-brand-green group-hover:bg-brand-green group-hover:text-primary-foreground focus-visible:border-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
        >
          Lihat Detail
          <ArrowRight className="h-4 w-4" />
        </Link>
      </footer>
    </article>
  )
}

/* ------------------------------------------------------------------------- *
 * Sisi 1 — foto & komponen
 * ------------------------------------------------------------------------- */

/**
 * Sisi depan. Bukan `<a>` — tautan sungguhannya ada di footer (lihat catatan di
 * kepala berkas); yang di sini cuma pintasan tetikus supaya menekan foto atau
 * daftar komponen ikut membuka detail.
 */
function SisiKomponen({ view, onOpen }: { view: PrebuildView; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="flex h-full w-full shrink-0 cursor-pointer snap-start flex-col"
    >
      {/* Tinggi tetap, BUKAN `aspect-*`: rasio membuat foto ikut melebar
          bersama kartunya dan memakan daftar komponen di layar kecil (catatan
          di kepala berkas). Tetap `object-contain`, jadi tidak ada foto yang
          terpotong — yang berubah cuma jatah ruangnya. */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden bg-white sm:h-44 xl:h-48">
        {/* Paket tanpa foto — atau yang fotonya gagal dimuat — tetap tampil
            dengan daftar komponen berikon; fiturnya tidak menunggu aset
            (docs/11-pc-prebuild.md §6). */}
        <ProductImage
          src={view.cover}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          fallbackClassName="flex-col gap-2"
          fallback={
            <>
              <ImageOff className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
              <span className="text-xs">Belum ada foto</span>
            </>
          }
        />
      </div>

      <div className="shrink-0 px-4 pb-2 pt-3">
        <h3 className="truncate text-base font-bold">{view.name}</h3>
        {view.summary && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{view.summary}</p>
        )}
      </div>

      {/* Empat komponen utama sudah berada di urutan teratas (toPrebuildView),
          jadi daftar ini cukup digulir untuk melihat sisanya — tidak ada dua
          daftar terpisah yang harus dijaga tetap sinkron.

          `overscroll-contain` supaya guliran yang mentok tidak merembet ke
          halaman: di deck berisi banyak kartu, itu membuat halaman melompat
          setiap kali seseorang selesai membaca isi satu paket. */}
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {view.components.map((component) => {
          const Ikon = COMPONENT_ROLE_ICONS[component.role]
          const option = component.options[0]

          return (
            <li key={component.key} className="flex items-center gap-2.5 py-1">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Ikon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold" title={option?.label}>
                  {option ? option.label : "Komponen tidak tersedia"}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {component.roleLabel}
                  {option && option.quantity > 1 ? ` · ${option.quantity} pcs` : ""}
                </span>
              </span>
              {component.missing && (
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-sale-red" />
              )}
              {component.branching && (
                <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  opsi
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------------- *
 * Sisi 2 — kecocokan & FPS
 * ------------------------------------------------------------------------- */

/**
 * Sisi belakang. Sama seperti sisi depan ia bukan `<a>` — dan di sini itu bukan
 * cuma soal kembar: ia punya kendali sendiri (dua baris filter), dan
 * membungkusnya dengan `<a>` akan membuat setiap penekanan tombol ikut membuka
 * halaman detail.
 *
 * Pintasan tetikusnya menempel di daftar game saja, bukan di seluruh sisi —
 * kalau seluruh sisi yang menerima klik, meleset sedikit dari tombol filter
 * berarti terlempar ke halaman lain.
 */
function SisiPerforma({
  view,
  games,
  onOpen,
}: {
  view: PrebuildView
  games: PrebuildGame[]
  onOpen: () => void
}) {
  const [resolution, setResolution] = useState<PrebuildFpsResolution>("1080p")
  const [quality, setQuality] = useState<PrebuildFpsQuality>("High")

  const performance = view.performance
  if (!performance) return null

  return (
    <div className="flex h-full w-full shrink-0 snap-start flex-col px-4 pb-4 pt-3">
      <div className="shrink-0">
        <h3 className="truncate text-base font-bold">{view.name}</h3>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          Cocok untuk
        </p>
      </div>

      <div className="mt-1.5 shrink-0">
        <UseCaseChips useCases={performance.useCases} />
      </div>

      {/* Dua baris filter, tiga kolom masing-masing. Sengaja bukan chart di
          kartu: yang dicari di daftar paket adalah angka yang bisa langsung
          dibandingkan antar kartu, dan batang butuh ruang yang di sini tidak
          ada. Chart-nya tetap ada di halaman detail. */}
      <div className="mt-3 shrink-0 space-y-1.5">
        <BarisFilter
          options={PREBUILD_FPS_RESOLUTIONS}
          value={resolution}
          onChange={setResolution}
          ariaLabel="Resolusi"
        />
        <BarisFilter
          options={PREBUILD_FPS_QUALITIES}
          value={quality}
          onChange={setQuality}
          ariaLabel="Setelan grafis"
        />
      </div>

      <ul
        onClick={onOpen}
        className="mt-2.5 min-h-0 flex-1 cursor-pointer divide-y overflow-y-auto overscroll-contain"
      >
        {games.map((game) => {
          const entry = findFpsEntry(performance.gaming.fps, game.id, resolution, quality)
          const nada = fpsTone(entry?.avg ?? 0)

          return (
            <li key={game.id} className="flex items-center gap-2 py-1.5">
              <GameMark game={game} />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={game.name}>
                {game.name}
              </span>
              {/* Sel kosong ditandai "—", bukan angka nol: "tidak dihitung"
                  adalah pernyataan yang berbeda dari "tidak sanggup". */}
              {entry ? (
                <span className="shrink-0 text-right">
                  <span className={`text-sm font-extrabold tabular-nums ${nada.text}`}>
                    {entry.avg}
                  </span>
                  <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
                    / {entry.low}
                  </span>
                </span>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">—</span>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-2 shrink-0 text-[10px] leading-tight text-muted-foreground">
        Angka besar = FPS rata-rata, kecil = 1% low. Perkiraan kasar, bukan hasil pengukuran.
      </p>
    </div>
  )
}

function BarisFilter<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="grid grid-cols-3 gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={opt === value}
          className={`cursor-pointer rounded-lg border py-1 text-[11px] font-semibold transition-colors ${
            opt === value
              ? "border-brand-green bg-brand-green text-primary-foreground"
              : "text-muted-foreground hover:border-brand-green/50 hover:text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
