"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Check, Loader2, Save, TriangleAlert } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildItem, PcPrebuildPreset } from "@/lib/pc-prebuild/config"
import type { PrebuildGame } from "@/lib/pc-prebuild/games"
import { MAX_BRANCHING_ITEMS } from "@/lib/pc-prebuild/limits"
import type { PrebuildPerformance } from "@/lib/pc-prebuild/performance"
import type { PrebuildPickerProduct } from "@/lib/pc-prebuild/products"
import { formatRupiah } from "@/lib/utils"

import { savePcPrebuildPreset } from "../actions"
import { AnalysisPanel } from "../_components/analysis-panel"
import { PresetImages } from "../_components/preset-images"
import { SlotBoard } from "../_components/slot-board"

/**
 * Editor satu paket — satu halaman yang dibaca dari atas ke bawah:
 * identitas → foto → komponen → analisis.
 *
 * Sengaja BUKAN tab. Menyusun paket adalah satu pekerjaan berurutan, dan tab
 * menyembunyikan bagian yang belum diisi — staff jadi menekan "Simpan" pada
 * paket yang komponennya masih kosong tanpa pernah melihat bagian itu.
 * Panjangnya dijawab dengan tombol lompat (kanan-tengah layar), bukan dengan
 * memotong halamannya jadi beberapa tab.
 *
 * ## Harga dijumlahkan di klien, dan itu boleh
 *
 * Yang dijumlahkan adalah harga satuan yang dikirim server dari katalog. Yang
 * DILARANG (CLAUDE.md §2.7) adalah menurunkan harga baru dari rumus — perkalian
 * persentase, potongan, "harga member". Tidak ada satu pun di sini, dan angka
 * ini tidak pernah ikut tersimpan ke preset.
 */

type Props = {
  initialPreset: PcPrebuildPreset
  isNew: boolean
  steps: PcBuilderStepConfig[]
  games: PrebuildGame[]
  initialCatalog: PrebuildPickerProduct[]
}

const BAGIAN = [
  { nomor: 1, id: "identitas", judul: "Nama & foto" },
  { nomor: 2, id: "komponen", judul: "Komponen" },
  { nomor: 3, id: "analisis", judul: "Analisis performa" },
] as const

export function PresetEditor({ initialPreset, isNew, steps, games, initialCatalog }: Props) {
  const router = useRouter()

  const [name, setName] = useState(initialPreset.name)
  const [summary, setSummary] = useState(initialPreset.summary)
  const [images, setImages] = useState<string[]>(initialPreset.images)
  const [slots, setSlots] = useState(initialPreset.slots)
  const [performance, setPerformance] = useState<PrebuildPerformance | null>(
    initialPreset.performance ?? null
  )

  const [katalog, setKatalog] = useState(() => new Map(initialCatalog.map((p) => [p.id, p])))

  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tersimpan, setTersimpan] = useState(false)

  /** Produk baru dari pencarian ditambahkan ke katalog, bukan menggantinya. */
  function pelajariProduk(products: PrebuildPickerProduct[]) {
    if (products.length === 0) return
    setKatalog((lama) => {
      const baru = new Map(lama)
      for (const p of products) baru.set(p.id, p)
      return baru
    })
  }

  function ubahSlot(stepId: string, items: PcPrebuildItem[]) {
    setTersimpan(false)
    setSlots((lama) => {
      const lain = lama.filter((s) => s.stepId !== stepId)
      // Slot yang kosong DIBUANG dari state, bukan disimpan sebagai slot tanpa
      // barang: parser toh membuangnya, dan menyimpannya membuat jumlah slot di
      // layar berbeda dari jumlah yang tersimpan.
      if (items.length === 0) return lain
      return [...lain, { stepId, items }]
    })
  }

  /** Harga satuan yang berlaku: variannya kalau ada, kalau tidak produknya sendiri. */
  function hargaSatuan(ref: { productId: number; variationId?: number }): number {
    const produk = katalog.get(ref.productId)
    if (!produk) return 0
    if (ref.variationId) {
      return produk.variations.find((v) => v.id === ref.variationId)?.price ?? 0
    }
    return produk.price
  }

  const semuaItem = useMemo(() => slots.flatMap((s) => s.items), [slots])

  const total = useMemo(
    () => semuaItem.reduce((jumlah, item) => jumlah + hargaSatuan(item) * item.quantity, 0),
    // `hargaSatuan` membaca `katalog`, jadi katalog ikut jadi ketergantungan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [semuaItem, katalog]
  )

  const bercabang = semuaItem.filter((i) => i.alternatives.length > 0).length
  const belumLengkap = semuaItem.filter((i) => i.productId <= 0).length

  /**
   * Nilai atribut yang WAJIB dipenuhi tiap langkah — aturan `dependSteps` /
   * `dependAttributes` milik PC Builder, ditegakkan sama persis seperti di
   * wizard (`features/builder/components/dynamic-builder-view.tsx`).
   *
   * Untuk tiap langkah: lihat langkah-langkah yang ia gantungi, ambil produk
   * yang sudah dipilih di sana, lalu kumpulkan nilai atribut yang id atributnya
   * terdaftar di `dependAttributes` langkah ini. Contoh nyatanya socket: begitu
   * prosesor AM4 dipilih, langkah Motherboard hanya menampilkan mainboard AM4.
   *
   * Tanpa ini, panel admin membiarkan staff menyusun paket yang komponennya
   * tidak bisa dipasang bersama — dan itu baru ketahuan di meja teknisi.
   */
  const syaratAtribut = useMemo(() => {
    const hasil = new Map<string, number[]>()

    for (const step of steps) {
      const nilai: number[] = []

      for (const depStepId of step.dependSteps ?? []) {
        const items = slots.find((s) => s.stepId === depStepId)?.items ?? []
        for (const item of items) {
          const produk = katalog.get(item.productId)
          if (!produk) continue
          for (const attr of produk.attributes) {
            if (step.dependAttributes?.includes(attr.attributeId)) nilai.push(attr.valueId)
          }
        }
      }

      hasil.set(step.id, nilai)
    }

    return hasil
  }, [steps, slots, katalog])

  async function simpan() {
    setMenyimpan(true)
    setError(null)
    try {
      const hasil = await savePcPrebuildPreset({
        id: initialPreset.id,
        name: name.trim() || "Paket tanpa nama",
        summary: summary.trim(),
        images,
        order: initialPreset.order,
        slots,
        ...(performance ? { performance } : {}),
      })

      if (!hasil.success) {
        setError(hasil.error ?? "Paket gagal disimpan.")
        return
      }

      setTersimpan(true)
      if (isNew) {
        // Pindah ke rutenya sendiri supaya menyegarkan halaman tidak membuka
        // paket baru yang kosong lagi.
        router.replace(`/admin/pc-prebuild/${encodeURIComponent(initialPreset.id)}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Paket gagal disimpan.")
    } finally {
      setMenyimpan(false)
    }
  }

  const TombolSimpan = (
    <button
      type="button"
      onClick={simpan}
      disabled={menyimpan}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {menyimpan ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : tersimpan ? (
        <Check className="h-4 w-4" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {tersimpan ? "Tersimpan" : "Simpan"}
    </button>
  )

  return (
    <TooltipProvider>
      {/* Margin negatif membatalkan padding milik `(panel)/layout.tsx`
          (`main` ber-`p-4 md:p-8`), supaya bilah atas membentang penuh sampai
          tepi kolom isi alih-alih menyisakan jalur latar di kiri-kanannya. */}
      <div className="-m-4 flex min-h-full flex-col md:-m-8">
        <BilahLengket>
          <div className="mx-auto flex w-full max-w-8xl flex-wrap items-center gap-3 px-4 py-3 md:px-8">
            <Link
              href="/admin/pc-prebuild"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-semibold transition-colors hover:border-brand-green hover:text-brand-green"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Semua paket</span>
            </Link>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {name.trim() || (isNew ? "Paket baru" : "Paket tanpa nama")}
              </p>
              <p className="text-xs text-muted-foreground">
                {semuaItem.length} komponen ·{" "}
                <span className="font-bold text-sale-red">{formatRupiah(total)}</span>
              </p>
            </div>

            {/* Di layar sempit tombolnya tinggal di bilah bawah, tempat ibu jari. */}
            <div className="hidden md:block">{TombolSimpan}</div>
          </div>
        </BilahLengket>

        <div className="mx-auto w-full max-w-8xl flex-1 space-y-8 px-4 py-6 pb-28 md:px-8 md:pb-10">
          {error && (
            <p className="flex items-start gap-2 rounded-xl border border-sale-red/30 bg-sale-red/5 px-4 py-3 text-sm text-sale-red">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <Bagian nomor={1} judul="Nama & foto" keterangan="Yang dilihat pelanggan lebih dulu.">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="min-w-0 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold">Nama paket</span>
                  <input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setTersimpan(false)
                    }}
                    placeholder="Mis. Esports Ready 1440p"
                    className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-green"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold">
                    Ringkasan <span className="font-normal text-muted-foreground">(opsional)</span>
                  </span>
                  <textarea
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value)
                      setTersimpan(false)
                    }}
                    rows={4}
                    placeholder="Satu-dua kalimat: paket ini untuk siapa, dan kuat untuk apa."
                    className="w-full resize-y rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-green"
                  />
                </label>
              </div>

              <PresetImages
                urls={images}
                onChange={(urls) => {
                  setImages(urls)
                  setTersimpan(false)
                }}
              />
            </div>
          </Bagian>

          <Bagian
            nomor={2}
            judul="Komponen"
            keterangan="Langkah, kategori, dan aturan ketergantungan atribut semuanya mengikuti PC Builder."
          >
            {steps.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                PC Builder belum punya langkah.{" "}
                <Link href="/admin/pc-builder" className="font-semibold underline">
                  Buat langkahnya dulu
                </Link>
                .
              </p>
            ) : (
              <>
                {/* Dua kolom di layar lebar. Satu kolom membuat kartu langkah
                    membentang selebar 96rem untuk isi yang cuma satu baris
                    produk — ruang terbuang, dan langkah ke-8 jadi jauh di bawah
                    lipatan. `items-start` supaya kartu pendek tidak ikut
                    meninggi mengikuti tetangganya. */}
                <div className="grid items-start gap-4 xl:grid-cols-2">
                  {steps.map((step) => (
                    <SlotBoard
                      key={step.id}
                      step={step}
                      items={slots.find((s) => s.stepId === step.id)?.items ?? []}
                      onChange={(items) => ubahSlot(step.id, items)}
                      katalog={katalog}
                      onLearn={pelajariProduk}
                      branchingLeft={Math.max(0, MAX_BRANCHING_ITEMS - bercabang)}
                      requiredAttributeValueIds={syaratAtribut.get(step.id) ?? []}
                    />
                  ))}
                </div>

                {belumLengkap > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-warning">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {belumLengkap} barang belum dipilih produknya dan tidak akan ikut tersimpan.
                  </p>
                )}
              </>
            )}
          </Bagian>

          <Bagian
            nomor={3}
            judul="Analisis performa"
            keterangan="Perlu komponen yang sudah final. Hasilnya masuk sebagai draf."
          >
            <AnalysisPanel
              presetId={initialPreset.id}
              presetName={name.trim() || "Paket tanpa nama"}
              slots={slots}
              games={games}
              performance={performance}
              // Sidik jarinya dihitung server saat menyimpan; di layar ini yang
              // dipakai adalah penanda dari data yang dimuat. Setelah komponen
              // diubah dan disimpan, halaman dimuat ulang dan penandanya benar.
              stale={initialPreset.performance !== undefined && slots !== initialPreset.slots}
              branchingCount={bercabang}
              onChange={(p) => {
                setPerformance(p)
                setTersimpan(false)
              }}
            />
          </Bagian>
        </div>

        <JumpRail />

        {/* Bilah simpan untuk layar sempit. Tetap terlihat sepanjang halaman —
            editor ini panjang, dan tombol simpan yang cuma ada di puncak berarti
            menggulir balik setiap kali. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
              <p className="truncate font-bold text-sale-red">{formatRupiah(total)}</p>
            </div>
            {TombolSimpan}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/**
 * Tombol lompat antar bagian — kanan, tengah layar, berurut dari atas.
 *
 * `fixed`, bukan `sticky`: ia harus tetap di tengah viewport berapa pun posisi
 * gulirannya, dan itu tidak bisa dicapai elemen yang ikut mengalir di dalam
 * kolom yang menggulir.
 *
 * Bagian yang sedang terlihat ditandai lewat `IntersectionObserver`. Tanpa
 * penanda itu ketiga tombol terlihat sama sepanjang waktu, dan kontrol yang
 * tidak pernah berubah rupa tidak terbaca sebagai penunjuk posisi — cuma tiga
 * tombol yang kebetulan menempel di tepi layar.
 */
function JumpRail() {
  const [aktif, setAktif] = useState<string>(BAGIAN[0].id)
  const sedangDiklik = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // Diabaikan selama guliran hasil klik masih berjalan: saat melompat ke
        // bagian 3, bagian 1 dan 2 ikut melintas dan penandanya berkedip
        // mundur sebelum sampai.
        if (sedangDiklik.current) return

        const terlihat = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]

        if (terlihat?.target.id) setAktif(terlihat.target.id)
      },
      // Ambang atas -20% supaya bagian dianggap "aktif" setelah kepalanya
      // benar-benar lewat bilah lengket, bukan saat baru menyentuh tepi bawah.
      { rootMargin: "-20% 0px -60% 0px" }
    )

    for (const b of BAGIAN) {
      const el = document.getElementById(b.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  function lompat(id: string) {
    const el = document.getElementById(id)
    if (!el) return

    sedangDiklik.current = true
    setAktif(id)
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    // Guliran halus tidak punya event "selesai" yang bisa diandalkan lintas
    // peramban; 700 ms cukup untuk jarak terjauh di halaman ini.
    setTimeout(() => {
      sedangDiklik.current = false
    }, 700)
  }

  return (
    <nav
      aria-label="Lompat ke bagian"
      className="fixed right-3 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 md:right-5"
    >
      {BAGIAN.map((b) => (
        <Tooltip key={b.id}>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={() => lompat(b.id)}
                aria-label={`Lompat ke ${b.judul}`}
                aria-current={aktif === b.id ? "true" : undefined}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold shadow-sm transition-all ${
                  aktif === b.id
                    ? "scale-110 border-brand-green bg-brand-green text-primary-foreground"
                    : "bg-background/90 text-muted-foreground backdrop-blur hover:border-brand-green hover:text-brand-green"
                }`}
              />
            }
          >
            {b.nomor}
          </TooltipTrigger>
          {/* Ke KIRI — tombolnya menempel di tepi kanan layar, jadi tooltip di
              sisi mana pun selain kiri akan terpotong. */}
          <TooltipContent side="left">{b.judul}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  )
}

/** Satu bagian bernomor. Nomornya menegaskan urutan pekerjaannya, bukan hiasan. */
function Bagian({
  nomor,
  judul,
  keterangan,
  children,
}: {
  nomor: number
  judul: string
  keterangan: string
  children: React.ReactNode
}) {
  const id = BAGIAN.find((b) => b.nomor === nomor)?.id ?? `bagian-${nomor}`

  return (
    // `scroll-mt` menahan kepala bagian dari tersembunyi di balik bilah lengket
    // saat dilompati. Tanpa ini, "Lompat ke Komponen" mendarat tepat di bawah
    // judulnya — bagian yang dituju justru yang tidak terlihat.
    <section id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-primary-foreground">
          {nomor}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">{judul}</h2>
          <p className="text-xs text-muted-foreground">{keterangan}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Bilah atas yang benar-benar menempel — SENGAJA tidak memakai `position: sticky`.
 *
 * ## Kenapa `sticky` tidak bisa dipakai di sini
 *
 * `position: sticky` terikat pada **leluhur penggulir terdekat**, bukan pada
 * jendela. Di panel admin, `main` di `(panel)/layout.tsx` memakai
 * `overflow-auto` — jadi ia yang jadi leluhur penggulir. Tapi induknya
 * `min-h-screen`, BUKAN `h-screen`: tingginya ikut tumbuh mengikuti isi, jadi
 * `main` sendiri tidak pernah menggulir. Yang menggulir jendelanya.
 *
 * Akibatnya bilah `sticky` tidak pernah menempel — ia cuma ikut tergulir pergi,
 * karena wadah tempat ia seharusnya menempel memang tidak bergerak. Gejalanya
 * membingungkan justru karena CSS-nya terlihat benar.
 *
 * Memperbaikinya di `layout.tsx` (`min-h-screen` → `h-screen`) memang lebih
 * bersih, tapi itu mengubah cara SELURUH halaman admin menggulir — termasuk
 * halaman yang sudah terlanjur mengandalkan guliran jendela. Perbaikan itu
 * pantas dikerjakan tersendiri, bukan sebagai efek samping halaman ini.
 *
 * ## Yang dipakai sebagai gantinya
 *
 * Penampung tetap di aliran halaman sebagai pengukur. Begitu tepi atasnya
 * melewati puncak layar, bilahnya beralih ke `fixed` dengan `left`/`width` yang
 * DISALIN dari penampung — tanpa itu ia akan melebar menutupi sidebar, karena
 * `fixed` mengukur dari jendela, bukan dari kolom isi.
 *
 * Penampungnya lalu diberi tinggi tetap seukuran bilah. Tanpa itu halaman
 * tersentak ke atas sejauh tinggi bilah tepat saat ia beralih ke `fixed` —
 * dan sentakan itu memicu peralihan balik, jadi bilahnya berkedip.
 */
function BilahLengket({ children }: { children: React.ReactNode }) {
  const penampung = useRef<HTMLDivElement>(null)
  const bilah = useRef<HTMLDivElement>(null)
  const [menempel, setMenempel] = useState(false)
  const [ukuran, setUkuran] = useState<{ left: number; width: number; height: number } | null>(null)

  useEffect(() => {
    /**
     * Menempel HANYA di `md` ke atas.
     *
     * Gunanya bilah ini di desktop adalah supaya "Simpan" tetap terjangkau
     * tanpa menggulir balik ke puncak. Di layar sempit tombol itu SUDAH ada di
     * bilah bawah, tempat ibu jari — jadi menempelkannya di atas tidak menambah
     * apa pun, dan justru menutupi navbar admin yang memang tinggal di puncak
     * layar pada mobile.
     */
    const layarLebar = window.matchMedia("(min-width: 768px)")

    function periksa() {
      const wadah = penampung.current
      const isi = bilah.current
      if (!wadah || !isi) return

      if (!layarLebar.matches) {
        setMenempel((lama) => (lama ? false : lama))
        return
      }

      const r = wadah.getBoundingClientRect()
      const tinggi = isi.offsetHeight

      // Dibandingkan dulu, baru disetel. Tanpa ini setiap piksel guliran
      // memicu render ulang seluruh editor.
      setUkuran((lama) =>
        lama && lama.left === r.left && lama.width === r.width && lama.height === tinggi
          ? lama
          : { left: r.left, width: r.width, height: tinggi }
      )
      // Tanda kurungnya WAJIB: `lama === r.top <= 0` terurai jadi
      // `(lama === r.top) <= 0`, yang selalu bernilai true dan membuat bilahnya
      // tidak pernah beralih.
      const lewat = r.top <= 0
      setMenempel((lama) => (lama === lewat ? lama : lewat))
    }

    // Ditunda satu bingkai: memanggilnya langsung di badan efek berarti
    // setState serentak di dalam efek, yang memicu render berantai.
    const bingkai = requestAnimationFrame(periksa)

    // Guliran bisa datang dari jendela ATAU dari elemen ber-`overflow` di
    // dalamnya. `capture: true` menangkap keduanya, karena event `scroll`
    // dari elemen tidak menggelembung ke `window`.
    window.addEventListener("scroll", periksa, { passive: true, capture: true })
    window.addEventListener("resize", periksa)
    // Ambang `md` bisa terlampaui tanpa `resize` — memutar tablet, misalnya.
    layarLebar.addEventListener("change", periksa)

    return () => {
      cancelAnimationFrame(bingkai)
      window.removeEventListener("scroll", periksa, { capture: true })
      window.removeEventListener("resize", periksa)
      layarLebar.removeEventListener("change", periksa)
    }
  }, [])

  return (
    <div
      ref={penampung}
      // Tinggi dikunci HANYA saat menempel — saat tidak, ia harus bebas
      // mengikuti tinggi bilah yang bisa berubah (nama paket yang membungkus
      // ke dua baris, misalnya).
      style={menempel && ukuran ? { height: ukuran.height } : undefined}
    >
      <div
        ref={bilah}
        className={`z-40 border-b bg-background shadow-sm ${menempel ? "fixed top-0" : "relative"}`}
        style={menempel && ukuran ? { left: ukuran.left, width: ukuran.width } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
