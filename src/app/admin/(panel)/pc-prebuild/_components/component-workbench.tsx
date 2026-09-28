"use client"

import Image from "next/image"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Info, Loader2, Minus, Package, Plus, Shuffle, Trash2, TriangleAlert } from "lucide-react"

import { ProductCardBuilder, type SelectedVariationLine } from "@/components/shared/product-card-builder"
import { BuilderQuickViewDialog } from "@/features/builder/components/builder-quick-view-dialog"
import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildItem, PcPrebuildSlot } from "@/lib/pc-prebuild/config"
import {
  MAX_ALTERNATIVES_PER_ITEM,
  MAX_ITEMS_PER_SLOT,
  MAX_QUANTITY_PER_ITEM,
} from "@/lib/pc-prebuild/limits"
import type { PrebuildPickerProduct } from "@/lib/pc-prebuild/products"
import type { BuilderProduct, BuilderVariation } from "@/store/new-builder"
import { formatRupiah } from "@/lib/utils"

import { AlternativesDialog } from "./alternatives-dialog"
import { kunciBarang, varianBawaan } from "./item-keys"
import { ProductSearchToolbar } from "./product-search-toolbar"
import { useProductSearch } from "./use-product-search"
import { DuplicateWarning, VariantChips } from "./variant-chips"

/**
 * Panel penyusun komponen paket — bagian 2 editor `/admin/pc-prebuild/[id]`.
 *
 * ## Satu langkah pada satu waktu, bukan semua langkah sekaligus
 *
 * Versi sebelumnya menampilkan SELURUH langkah sebagai grid dua kolom kartu
 * `SlotBoard`, dan tiap kartu punya pencarinya sendiri berupa dropdown kecil.
 * Bentuk itu punya dua masalah yang tidak bisa diperbaiki tanpa menggantinya:
 * daftar produk cuma muat 12 baris teks di dalam popup selebar kartu, dan
 * staff memilih komponen tanpa pernah melihat fotonya — padahal foto adalah
 * cara tercepat mengenali barang yang namanya cuma beda satu digit
 * ("B550M-PLUS" vs "B550M-PLUS II").
 *
 * Sekarang: rail langkah di kiri, dan satu panel kerja di kanan berisi grid
 * produk yang sama bentuknya dengan yang dilihat pelanggan di `/build-pc` —
 * kartu yang sama persis (`components/shared/product-card-builder`), Quick
 * Preview yang sama, pencarian dan pengurutan yang sama.
 *
 * ## Tingginya dikunci satu layar, dan yang menggulir isinya
 *
 * Seluruh papan ini setinggi `100dvh`; yang menggulir adalah **baris komponen
 * terpilih** (mendatar) dan **grid produk** (menurun), masing-masing di dalam
 * wadahnya sendiri.
 *
 * Sebelumnya papan ini ikut memanjangkan halaman editor, dan grid produk yang
 * berisi ratusan barang membuat bagian 3 dan 4 (harga & analisis) terdorong
 * ribuan piksel ke bawah — menggulir dari komponen ke harga jadi perjalanan
 * yang panjangnya bergantung pada berapa banyak produk yang kebetulan dimuat.
 * Dengan tinggi terkunci, panjang halaman editor tidak lagi ditentukan oleh isi
 * katalog.
 *
 * Konsekuensinya bilah alat dan baris terpilih TIDAK ikut tergulir keluar saat
 * staff menyisir grid — itu justru yang diinginkan: keduanya kontrol, bukan
 * isi.
 *
 * ## Tanda asal panel
 *
 * Tab aktif dan kepala panel kanan memakai aksen yang sama, dan nomor
 * langkahnya diulang di kepala panel. Isi panel ini berubah total setiap kali
 * tab ditekan; tanpa penanda itu, staff yang kembali dari menggulir grid tidak
 * punya cara tahu komponen apa yang sedang disusunnya.
 *
 * ## Yang TIDAK berubah
 *
 * Bentuk datanya sama persis (`items` + `alternatives`), beserta seluruh aturan
 * yang sudah ditulis di docs/11-pc-prebuild.md §2 dan §4: chip varian
 * multi-select, promosi bawaan, varian terakhir tak bisa dimatikan, peringatan
 * baris kembar, dan semua `MAX_*`. Yang diganti cuma cara memilih produknya.
 */

type Props = {
  steps: PcBuilderStepConfig[]
  slots: PcPrebuildSlot[]
  onChangeSlot: (stepId: string, items: PcPrebuildItem[]) => void
  /** Produk yang sudah dikenal — hasil pramuat server plus hasil pencarian. */
  katalog: Map<number, PrebuildPickerProduct>
  /** Dipanggil saat pencarian membawa produk baru, supaya katalognya tumbuh. */
  onLearn: (products: PrebuildPickerProduct[]) => void
  /** Sisa jatah barang bercabang di seluruh paket. 0 = tidak boleh menambah lagi. */
  branchingLeft: number
  /** Syarat atribut per langkah — hasil `dependSteps`/`dependAttributes`. */
  syaratAtribut: Map<string, AttributeRequirementGroup[]>
}

export function ComponentWorkbench({
  steps,
  slots,
  onChangeSlot,
  katalog,
  onLearn,
  branchingLeft,
  syaratAtribut,
}: Props) {
  const [stepAktif, setStepAktif] = useState(steps[0]?.id ?? "")

  const step = steps.find((s) => s.id === stepAktif) ?? steps[0] ?? null

  /**
   * Atribut yang ditampilkan sebagai badge di kartu produk: seluruh atribut
   * yang dipakai aturan ketergantungan langkah mana pun. Sama persis dengan
   * `configuredAttributeIds` milik wizard, supaya badge di panel admin dan di
   * `/build-pc` tidak menyebut hal yang berbeda.
   */
  const atributBadge = useMemo(() => {
    const ids = new Set<number>()
    for (const s of steps) for (const id of s.dependAttributes ?? []) ids.add(id)
    return [...ids]
  }, [steps])

  if (!step) return null

  return (
    <div className="grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[13rem_minmax(0,1fr)] lg:grid-rows-1 lg:gap-4">
      <StepRail steps={steps} slots={slots} aktif={step.id} onPilih={setStepAktif} />

      {/* `key` membuat seluruh state panel (kata kunci, urutan, filter, halaman)
          lahir ulang saat langkah berganti. Membawa kata kunci "ryzen" dari
          langkah Prosesor ke langkah Casing berarti grid casing tampil kosong
          dengan sebab yang tidak terlihat di layar. */}
      <StepPanel
        key={step.id}
        step={step}
        items={slots.find((s) => s.stepId === step.id)?.items ?? []}
        onChange={(items) => onChangeSlot(step.id, items)}
        katalog={katalog}
        onLearn={onLearn}
        branchingLeft={branchingLeft}
        requiredAttributeValueGroups={syaratAtribut.get(step.id) ?? []}
        atributBadge={atributBadge}
      />
    </div>
  )
}

/**
 * Rail langkah. Vertikal di layar lebar, strip yang bisa digeser di layar
 * sempit (CLAUDE.md §2.6) — bukan dropdown, karena jumlah barang per langkah
 * lain ikut hilang begitu daftarnya tertutup.
 */
function StepRail({
  steps,
  slots,
  aktif,
  onPilih,
}: {
  steps: PcBuilderStepConfig[]
  slots: PcPrebuildSlot[]
  aktif: string
  onPilih: (stepId: string) => void
}) {
  return (
    <nav aria-label="Langkah komponen" className="min-h-0 min-w-0 lg:overflow-y-auto">
      <ul className="flex gap-1.5 overflow-x-auto pb-1.5 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
        {steps.map((step, index) => {
          const items = slots.find((s) => s.stepId === step.id)?.items ?? []
          const belumLengkap = items.some((i) => i.productId <= 0)
          const dibuka = step.id === aktif

          return (
            <li key={step.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onPilih(step.id)}
                aria-current={dibuka ? "true" : undefined}
                className={`flex w-full min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors ${
                  dibuka
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "hover:border-brand-green/50 hover:bg-muted"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
                    dibuka
                      ? "bg-brand-green text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold lg:whitespace-normal lg:break-words">
                    {step.name}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {items.length === 0 ? "Kosong" : `${items.length} barang`}
                  </span>
                </span>

                {/* Titik merah, bukan angka: yang perlu diketahui sekilas cuma
                    "ada yang belum beres di sini", dan jumlahnya toh terbaca
                    begitu tabnya dibuka. */}
                {belumLengkap && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-sale-red"
                    title="Ada barang yang belum dipilih produknya"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Produk admin → bentuk yang dimengerti Quick Preview milik wizard. */
function keBuilderProduct(p: PrebuildPickerProduct): BuilderProduct {
  const variations: BuilderVariation[] = p.variations.map((v) => ({
    id: v.id,
    label: v.label,
    price: v.price,
    regularPrice: v.regularPrice,
    salePrice: v.salePrice,
    stock: v.stock,
    ...(v.image ? { image: v.image } : {}),
  }))

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    price: p.cardPrice,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice,
    // Panel admin tidak menampilkan angka terjual di mana pun; bidangnya wajib
    // ada karena dipakai kartu katalog, bukan kartu ini.
    sold: 0,
    stock: p.cardStock,
    ...(p.image ? { image: p.image } : {}),
    attributes: p.attributes,
    ...(variations.length > 0 ? { variations } : {}),
  }
}

function StepPanel({
  step,
  items,
  onChange,
  katalog,
  onLearn,
  branchingLeft,
  requiredAttributeValueGroups,
  atributBadge,
}: {
  step: PcBuilderStepConfig
  items: PcPrebuildItem[]
  onChange: (items: PcPrebuildItem[]) => void
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  branchingLeft: number
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  atributBadge: number[]
}) {
  const search = useProductSearch({
    categoryIds: step.categoryIds ?? [],
    requiredAttributeValueGroups,
    onLearn,
  })

  const [quickView, setQuickView] = useState<PrebuildPickerProduct | null>(null)
  const [quickViewBuka, setQuickViewBuka] = useState(false)

  /** Indeks barang yang pilihan tukarnya sedang dibuka di dialog. */
  const [tukarUntuk, setTukarUntuk] = useState<number | null>(null)
  const [tukarBuka, setTukarBuka] = useState(false)

  /**
   * Keterangan sesaat di bawah bilah alat — mis. saat penambahan ditolak.
   *
   * `nada` dibedakan karena salah satu pesannya BUKAN penolakan: keterangan
   * arti barang kedua muncul justru saat penambahannya BERHASIL, dan rupa
   * peringatan membuatnya terbaca sebagai kesalahan yang perlu dibatalkan.
   */
  const [pesan, setPesan] = useState<{ teks: string; nada: "info" | "peringatan" } | null>(null)
  /**
   * Kotak yang sedang ditunjuk — indeksnya, plus `tanda` supaya penunjukan
   * berulang ke kotak yang sama tetap terbaca sebagai kejadian baru.
   */
  const [sorot, setSorot] = useState<{ index: number; tanda: number } | null>(null)

  const barisTerpilih = useRef<HTMLDivElement>(null)

  // Guliran ke kotak yang ditunjuk, lalu sorotannya padam sendiri — ia cuma
  // penunjuk arah, bukan status.
  useEffect(() => {
    if (!sorot) return
    barisTerpilih.current
      ?.querySelector<HTMLElement>(`[data-item="${sorot.index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })

    const timer = setTimeout(() => setSorot(null), 1600)
    return () => clearTimeout(timer)
  }, [sorot])

  useEffect(() => {
    if (!pesan) return
    const timer = setTimeout(() => setPesan(null), 5000)
    return () => clearTimeout(timer)
  }, [pesan])

  const kunciItems = items.map(kunciBarang)

  const bolehTambahBarang =
    items.length < MAX_ITEMS_PER_SLOT && (step.allowMultiple === true || items.length === 0)

  function ubahItem(index: number, patch: Partial<PcPrebuildItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  /** Kunci barang LAIN di slot ini — dipakai mematikan varian yang akan kembar. */
  function kunciLain(index: number): Set<string> {
    return new Set(kunciItems.filter((_, j) => j !== index && items[j].productId > 0))
  }

  /**
   * Tunjuk satu kotak: gulirkan ke sana dan sorot sebentar.
   *
   * Guliran dikerjakan di efek, bukan di sini. Untuk barang yang BARU
   * ditambahkan, kotaknya belum ada di DOM saat fungsi ini dipanggil —
   * `querySelector` di sini tidak menemukan apa pun, dan justru kasus "barang
   * baru masuk di ujung baris yang sudah penuh" itulah yang paling butuh
   * digulirkan.
   */
  function sorotBarang(index: number) {
    setSorot((lama) => ({ index, tanda: (lama?.tanda ?? 0) + 1 }))
  }

  /**
   * Produk ditekan di grid.
   *
   * Tiga cabang, dan bedanya penting: menambah barang baru, MENGGANTI barang
   * yang ada (langkah yang cuma menampung satu), atau menunjuk barang yang
   * sudah dipakai alih-alih menambahkannya dua kali.
   */
  function pilihDariGrid(p: PrebuildPickerProduct, variationId?: number) {
    const sudahAda = items.findIndex((i) => i.productId === p.id)
    if (sudahAda >= 0) {
      // Produk yang sudah dipakai tidak ditambahkan lagi diam-diam: kalau yang
      // dimaksud staff adalah varian kedua, tempatnya chip Varian di kotaknya —
      // dan kotak itulah yang ditunjuk.
      if (variationId && variationId !== items[sudahAda].variationId) {
        ubahVarianUtama(sudahAda, variationId)
      }
      sorotBarang(sudahAda)
      return
    }

    if (step.allowMultiple !== true && items.length > 0) {
      // Langkah satu-barang: produk baru MENGGANTI yang sekarang. Pilihan
      // tukarnya ikut dibuang — semuanya menunjuk produk yang sudah tidak ada
      // di barang ini lagi.
      const terpakai = kunciLain(0)
      onChange(
        items.map((item, i) =>
          i === 0
            ? {
                productId: p.id,
                variationId: variationId ?? varianBawaan(p, terpakai),
                quantity: item.quantity,
                alternatives: [],
              }
            : item
        )
      )
      setPesan({
        teks: `Langkah "${step.name}" disetel hanya boleh satu barang di PC Builder, jadi komponennya diganti.`,
        nada: "peringatan",
      })
      sorotBarang(0)
      return
    }

    if (!bolehTambahBarang) {
      setPesan({
        teks: `Satu langkah paling banyak ${MAX_ITEMS_PER_SLOT} barang.`,
        nada: "peringatan",
      })
      return
    }

    const terpakai = new Set(kunciItems.filter((_, j) => items[j].productId > 0))
    onChange([
      ...items,
      {
        productId: p.id,
        // Produk bervarian LANGSUNG memakai salah satu variannya, bukan
        // menunggu staff memilih. Induk VARIABLE tidak punya harga sendiri,
        // jadi barang yang "belum dipilih variannya" akan masuk total sebagai
        // nol rupiah — persis jenis angka diam-diam salah yang paling sulit
        // ketahuan.
        variationId: variationId ?? varianBawaan(p, terpakai),
        quantity: 1,
        alternatives: [],
      },
    ])

    // Barang KEDUA adalah titik tempat "dan" paling mudah dibaca sebagai
    // "atau", dan keterangan permanen di baris terpilih tidak cukup: saat
    // menekan kartu, yang ditatap staff adalah grid, bukan barisnya. Karena
    // itu artinya dinyatakan di sini — di detik salah pahamnya terjadi —
    // beserta jalan keluarnya, supaya staff tidak perlu menebak di mana
    // "pelanggan pilih salah satu" diatur.
    if (items.length > 0) {
      setPesan({
        teks: `Barang ke-${items.length + 1} ditambahkan. Semua barang di langkah "${step.name}" dipasang BERSAMAAN dan semuanya masuk total paket. Kalau maksudnya pelanggan memilih salah satu, hapus barang ini lalu pakai tombol "Pilihan tukar" di kotak barang yang mau ditukar.`,
        nada: "info",
      })
    }

    sorotBarang(items.length)
  }

  /** Varian produk UTAMA yang sedang ditawarkan, bawaan lebih dulu. */
  function varianAktif(item: PcPrebuildItem): number[] {
    return [
      ...(item.variationId ? [item.variationId] : []),
      ...item.alternatives
        .filter((a) => a.productId === item.productId && a.variationId)
        .map((a) => a.variationId as number),
    ]
  }

  /**
   * Jatah pilihan masih tersisa. Dua syarat, bukan satu: jumlahnya belum
   * mentok, DAN barang ini boleh bercabang sama sekali (`MAX_BRANCHING_ITEMS`
   * dihitung per paket, bukan per barang).
   */
  function bolehTambahPilihan(item: PcPrebuildItem): boolean {
    const bolehBercabang = item.alternatives.length > 0 || branchingLeft > 0
    return item.alternatives.length < MAX_ALTERNATIVES_PER_ITEM && bolehBercabang
  }

  /** Nyalakan/matikan satu varian produk utama sebuah barang. */
  function ubahVarianUtama(index: number, vId: number) {
    const item = items[index]
    const produk = katalog.get(item.productId)
    if (!produk) return

    const aktif = varianAktif(item)
    const sudah = aktif.includes(vId)

    if (!sudah) {
      if (!bolehTambahPilihan(item)) {
        setPesan({
          teks: `Satu barang paling banyak menawarkan ${MAX_ALTERNATIVES_PER_ITEM + 1} varian, dan jatah komponen bercabang paketnya juga terbatas.`,
          nada: "peringatan",
        })
        return
      }
      ubahItem(index, {
        alternatives: [
          ...item.alternatives,
          { productId: item.productId, variationId: vId, quantity: item.quantity },
        ],
      })
      return
    }

    if (aktif.length <= 1) return

    if (vId !== item.variationId) {
      ubahItem(index, {
        alternatives: item.alternatives.filter(
          (a) => !(a.productId === item.productId && a.variationId === vId)
        ),
      })
      return
    }

    // Yang dimatikan adalah BAWAANnya — varian aktif berikutnya naik
    // menggantikannya, lalu barisnya keluar dari daftar pilihan. Tanpa promosi
    // ini barangnya kehilangan `variationId` dan harganya jatuh ke harga induk
    // yang sering nol.
    const penerus = item.alternatives.find(
      (a) => a.productId === item.productId && a.variationId && a.variationId !== vId
    )
    if (!penerus) return
    ubahItem(index, {
      variationId: penerus.variationId,
      alternatives: item.alternatives.filter((a) => a !== penerus),
    })
  }

  /**
   * Pindahkan bawaan. Yang lama TURUN jadi pilihan di posisi yang sama, bukan
   * dibuang: bawaan cuma soal mana yang terpilih duluan di halaman pelanggan.
   */
  function jadikanBawaan(index: number, vId: number) {
    const item = items[index]
    if (!item.variationId || vId === item.variationId) return
    const calon = item.alternatives.find(
      (a) => a.productId === item.productId && a.variationId === vId
    )
    if (!calon) return
    ubahItem(index, {
      variationId: vId,
      alternatives: item.alternatives.map((a) =>
        a === calon ? { ...a, variationId: item.variationId } : a
      ),
    })
  }

  /**
   * Barang yang dialog pilihan tukarnya sedang terbuka.
   *
   * Diturunkan, bukan dibereskan lewat efek yang memanggil `setTukarUntuk(null)`.
   * Barang yang dituju bisa lenyap di tengah jalan — staff menghapus kotaknya —
   * dan indeks yang tertinggal tidak menunjuk "tidak ada" melainkan BARANG LAIN
   * begitu staff menambah komponen berikutnya.
   */
  const indexTukar = tukarUntuk !== null && items[tukarUntuk] ? tukarUntuk : null
  const itemTukar = indexTukar !== null ? items[indexTukar] : null

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2.5">
      {/* Kepala panel — penanda asal isi panel ini. */}
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-1 border-b pb-2">
        <h3 className="text-base font-bold">{step.name}</h3>
        <p className="text-xs text-muted-foreground">
          {items.length === 0
            ? "Belum ada komponen"
            : `${items.length} barang${step.allowMultiple ? ` · maks ${MAX_ITEMS_PER_SLOT}` : " · langkah satu-barang"}`}
        </p>
      </div>

      {/* Keterangan yang menamai arti deretan kotak di bawahnya.
          Hanya muncul saat barangnya lebih dari satu — pada satu barang tidak
          ada apa pun yang bisa tertukar, dan baris yang selalu ada berhenti
          dibaca justru pada saat ia dibutuhkan. Kalimatnya sengaja memakai
          kosakata yang sama dengan kotak varian ("pelanggan memilih salah
          satunya"), supaya staff tidak perlu belajar dua istilah untuk satu
          perbedaan. */}
      {items.length > 1 && (
        <p className="shrink-0 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11px] leading-snug text-muted-foreground">
          <span className="font-bold text-foreground">Dipasang bersamaan.</span> {items.length}{" "}
          barang di bawah semuanya ikut dalam rakitan dan masuk total paket — bukan pilihan.
          Untuk barang yang <span className="font-semibold">ditukar</span> pelanggan, pakai tombol
          &quot;Pilihan tukar&quot; di kotak barangnya.
        </p>
      )}

      {/* Baris komponen terpilih — menggulir MENDATAR, dan tingginya tetap. */}
      {items.length === 0 ? (
        <p className="shrink-0 rounded-xl border border-dashed px-4 py-3 text-center text-xs text-muted-foreground">
          Langkah ini belum dipakai paket. Pilih produk dari daftar di bawah untuk mengisinya.
        </p>
      ) : (
        <div
          ref={barisTerpilih}
          className="flex shrink-0 gap-2.5 overflow-x-auto pb-1.5"
          role="list"
          aria-label={`Komponen terpilih untuk ${step.name}`}
        >
          {items.map((item, index) => (
            <Fragment key={`${step.id}-${index}`}>
              {/* "+" antar kotak: pernyataan "DAN" yang terbaca tanpa membaca
                  kalimat apa pun, dan itu yang dibutuhkan staff yang sedang
                  menyisir grid. `aria-hidden` karena arti yang sama sudah
                  disampaikan keterangan di atas baris kepada pembaca layar,
                  dan `role="list"` di wadahnya hanya boleh berisi `listitem`. */}
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center self-center text-base font-bold text-muted-foreground/70"
                >
                  +
                </span>
              )}
              <SelectedItemCard
                data-item={index}
                item={item}
                index={index}
                katalog={katalog}
                varianAktif={varianAktif(item)}
                bolehTambahPilihan={bolehTambahPilihan(item)}
                duplicate={item.productId > 0 && kunciItems.indexOf(kunciItems[index]) < index}
                takenKeys={kunciLain(index)}
                disorot={sorot?.index === index}
                onToggleVarian={(vId) => ubahVarianUtama(index, vId)}
                onBawaan={(vId) => jadikanBawaan(index, vId)}
                onQuantity={(q) => ubahItem(index, { quantity: q })}
                onBukaTukar={() => {
                  setTukarUntuk(index)
                  setTukarBuka(true)
                }}
                onRemove={() => onChange(items.filter((_, i) => i !== index))}
              />
            </Fragment>
          ))}
        </div>
      )}

      <div className="shrink-0">
        <ProductSearchToolbar
          search={search}
          stepId={step.id}
          stepName={step.name}
          categoryIds={step.categoryIds ?? []}
          requiredAttributeValueGroups={requiredAttributeValueGroups}
        />
      </div>

      {pesan && (
        <p
          className={`flex shrink-0 items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ${
            pesan.nada === "info"
              ? "bg-brand-green/5 text-brand-green"
              : "bg-warning/5 text-warning"
          }`}
        >
          {pesan.nada === "info" ? (
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          {pesan.teks}
        </p>
      )}

      {requiredAttributeValueGroups.length > 0 && (
        <p className="shrink-0 rounded-lg bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
          Disaring mengikuti aturan PC Builder — hanya produk yang cocok dengan komponen di langkah
          sebelumnya.
        </p>
      )}

      {/* Grid produk — SATU-SATUNYA bagian yang menggulir menurun di panel ini.

          `pb-20` di layar sempit: bilah simpan editor `fixed` di dasar layar
          dan hanya tampil di bawah `md`. Tanpa ruang itu, kartu baris terakhir
          selalu setengah tertutup — dan karena wadah ini yang menggulir, bukan
          halamannya, tidak ada lagi guliran yang bisa membebaskannya. */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-20 md:pb-0">
        {search.memuat ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
          </div>
        ) : search.hasil.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center">
            <h4 className="text-sm font-bold">Tidak ada produk yang cocok</h4>
            <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
              {search.jumlahFilter > 0
                ? "Coba cabut sebagian filter atributnya."
                : requiredAttributeValueGroups.length > 0
                  ? "Tidak ada produk yang cocok dengan komponen yang sudah dipilih di langkah sebelumnya."
                  : "Coba kata kunci lain."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {search.hasil.map((p) => {
                const barisKartu = items.filter((i) => i.productId === p.id)
                const jumlah = barisKartu.reduce((total, i) => total + i.quantity, 0)

                const variasiTerpilih: SelectedVariationLine[] = barisKartu
                  .filter((i) => i.variationId)
                  .map((i) => ({
                    variationId: i.variationId as number,
                    label:
                      p.variations.find((v) => v.id === i.variationId)?.label ?? `#${i.variationId}`,
                    quantity: i.quantity,
                    stock: p.variations.find((v) => v.id === i.variationId)?.stock ?? 0,
                  }))

                return (
                  <ProductCardBuilder
                    key={p.id}
                    product={{
                      id: p.id,
                      name: p.name,
                      price: p.cardPrice,
                      regularPrice: p.regularPrice,
                      salePrice: p.salePrice,
                      image: p.image,
                      stock: p.cardStock,
                      attributes: p.attributes,
                      variations: p.variations,
                    }}
                    quantity={jumlah}
                    selectedVariations={variasiTerpilih}
                    allowMultiple={step.allowMultiple ?? false}
                    displayAttributeIds={atributBadge}
                    onSelect={() => pilihDariGrid(p)}
                    onQuickView={() => {
                      setQuickView(p)
                      setQuickViewBuka(true)
                    }}
                    onUpdateQuantity={(q) => {
                      const index = items.findIndex((i) => i.productId === p.id)
                      if (index < 0) return
                      if (q <= 0) onChange(items.filter((_, i) => i !== index))
                      else ubahItem(index, { quantity: Math.min(MAX_QUANTITY_PER_ITEM, q) })
                    }}
                    onUpdateVariationQuantity={(variationId, q) => {
                      const index = items.findIndex(
                        (i) => i.productId === p.id && i.variationId === variationId
                      )
                      if (index < 0) return
                      if (q <= 0) onChange(items.filter((_, i) => i !== index))
                      else ubahItem(index, { quantity: Math.min(MAX_QUANTITY_PER_ITEM, q) })
                    }}
                  />
                )
              })}
            </div>

            {search.adaLagi && (
              <div className="flex justify-center pb-2">
                <button
                  type="button"
                  onClick={search.muatLagi}
                  disabled={search.memuatLagi}
                  className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors hover:border-brand-green hover:text-brand-green disabled:opacity-50"
                >
                  {search.memuatLagi && <Loader2 className="h-4 w-4 animate-spin" />}
                  Muat lebih banyak
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AlternativesDialog
        open={tukarBuka && itemTukar !== null}
        onOpenChange={setTukarBuka}
        step={step}
        requiredAttributeValueGroups={requiredAttributeValueGroups}
        item={itemTukar}
        katalog={katalog}
        onLearn={onLearn}
        atributBadge={atributBadge}
        branchingLeft={branchingLeft}
        onChange={(alternatives) => {
          if (indexTukar === null) return
          ubahItem(indexTukar, { alternatives })
        }}
      />

      {/*
        SELALU ter-mount, termasuk saat produknya `null` — alasannya ada di
        `variation-picker-dialog.tsx`: melepas dialog dari pohon saat menutup
        membuat `useBackToClose` kehilangan kesempatan mengembalikan entri
        riwayat bonekanya.
      */}
      <BuilderQuickViewDialog
        open={quickViewBuka}
        onOpenChange={setQuickViewBuka}
        product={quickView ? keBuilderProduct(quickView) : null}
        selectedQuantity={
          quickView
            ? items
                .filter((i) => i.productId === quickView.id)
                .reduce((total, i) => total + i.quantity, 0)
            : 0
        }
        selectedVariationIds={
          quickView
            ? items.filter((i) => i.productId === quickView.id).flatMap((i) => varianAktif(i))
            : []
        }
        allowMultiple={step.allowMultiple ?? false}
        onSelect={() => {
          if (quickView) pilihDariGrid(quickView)
          setQuickViewBuka(false)
        }}
        onPickVariation={(variation) => {
          if (quickView) pilihDariGrid(quickView, variation.id)
          setQuickViewBuka(false)
        }}
      />
    </div>
  )
}

/**
 * Satu kotak di baris komponen terpilih: barangnya, variannya, dan jumlahnya.
 *
 * Kotak, bukan baris selebar panel: satu langkah bisa menampung sampai empat
 * barang terpasang bersamaan (dua NVMe, empat keping RAM), dan empat baris
 * penuh mendorong grid produk keluar layar — padahal grid itulah tempat
 * pekerjaannya berlangsung.
 *
 * **Tinggi kotaknya sengaja tetap.** Daftar pilihan tukar tinggal di dialog
 * tersendiri, dan area chip varian menggulir di dalam kotaknya. Versi pertama
 * membuka keduanya di tempat, dan setiap kali dibuka seluruh kotak tetangganya
 * bergeser — staff kehilangan tempat yang barusan ditunjuknya.
 */
function SelectedItemCard({
  item,
  index,
  katalog,
  varianAktif,
  bolehTambahPilihan,
  duplicate,
  takenKeys,
  disorot,
  onToggleVarian,
  onBawaan,
  onQuantity,
  onBukaTukar,
  onRemove,
  ...rest
}: {
  item: PcPrebuildItem
  index: number
  katalog: Map<number, PrebuildPickerProduct>
  varianAktif: number[]
  bolehTambahPilihan: boolean
  duplicate: boolean
  takenKeys: Set<string>
  disorot: boolean
  onToggleVarian: (variationId: number) => void
  onBawaan: (variationId: number) => void
  onQuantity: (quantity: number) => void
  onBukaTukar: () => void
  onRemove: () => void
} & Record<`data-${string}`, unknown>) {
  const produk = katalog.get(item.productId) ?? null
  const varian = produk?.variations.find((v) => v.id === item.variationId) ?? null

  // Harga yang berlaku: variannya kalau ada, kalau tidak produknya sendiri.
  // Induk VARIABLE sering berharga nol — memakai harganya akan membuat total
  // paket terlihat jauh lebih murah daripada yang sebenarnya.
  const harga = varian ? varian.price : (produk?.price ?? 0)
  const stok = varian ? varian.stock : (produk?.stock ?? 0)

  /** Pilihan tukar yang menunjuk produk LAIN — varian produk utama tidak ikut. */
  const jumlahTukar = new Set(
    item.alternatives.filter((a) => a.productId !== item.productId).map((a) => a.productId)
  ).size

  return (
    <div
      {...rest}
      role="listitem"
      className={`flex w-64 shrink-0 flex-col gap-2 rounded-xl border bg-card p-2.5 transition-shadow ${
        disorot ? "ring-2 ring-brand-green" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {produk?.image ? (
          <Image
            src={produk.image}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-md border bg-white object-contain"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <Package className="h-4 w-4" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Barang {index + 1}
          </p>
          {produk ? (
            <p className="line-clamp-2 text-[11px] font-semibold leading-snug">{produk.name}</p>
          ) : (
            <p className="text-[11px] font-semibold text-sale-red">
              Produk #{item.productId} tidak ada di katalog
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Hapus barang"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-sale-red hover:text-sale-red"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {duplicate && (
        <DuplicateWarning text="Barang ini sama persis dengan barang lain di langkah ini — yang kembar tidak ikut tersimpan. Pilih varian lain, atau hapus salah satunya." />
      )}

      {produk && produk.variations.length > 0 && (
        <div className="space-y-1.5">
          {/* Area chip MENGGULIR di dalam kotak. Produk dengan belasan varian
              akan menumbuhkan kotaknya sampai baris terpilih setinggi setengah
              layar, dan grid produk yang terdorong ke bawah adalah persis yang
              sedang dihindari tata letak ini. */}
          <div className="max-h-20 overflow-y-auto pr-0.5">
            <VariantChips
              compact
              productId={produk.id}
              variations={produk.variations}
              selectedIds={varianAktif}
              defaultId={item.variationId}
              canAdd={bolehTambahPilihan}
              takenKeys={takenKeys}
              onToggle={onToggleVarian}
            />
          </div>

          {varianAktif.length > 1 && (
            <>
              {/* Bawaan dipilih lewat select, bukan lewat klik kedua pada chip:
                  chip sudah punya satu arti (ditawarkan / tidak), dan menumpuk
                  arti kedua di atasnya membuat mematikan varian dan memindah
                  bawaan saling tertukar. */}
              <label className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Bawaan
                </span>
                <select
                  value={item.variationId ?? 0}
                  onChange={(e) => onBawaan(Number(e.target.value))}
                  className="min-w-0 flex-1 rounded-lg border bg-background px-1.5 py-0.5 text-[11px] font-semibold"
                >
                  {varianAktif.map((id) => (
                    <option key={id} value={id}>
                      {produk.variations.find((v) => v.id === id)?.label ?? `#${id}`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[10px] leading-snug text-muted-foreground">
                {varianAktif.length} varian ditawarkan — pelanggan memilih salah satunya. Yang masuk
                total paket adalah bawaannya.
              </p>
            </>
          )}
        </div>
      )}

      {produk && stok <= 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/5 px-2 py-1 text-[10px] leading-snug text-warning">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          Stok kosong. Paket tetap bisa disimpan.
        </p>
      )}

      {produk && (
        <div className="mt-auto space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center rounded-lg border">
              <button
                type="button"
                onClick={() => onQuantity(Math.max(1, item.quantity - 1))}
                disabled={item.quantity <= 1}
                aria-label="Kurangi jumlah"
                className="flex h-6 w-6 items-center justify-center rounded-l-lg transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-6 text-center text-[11px] font-bold tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onQuantity(Math.min(MAX_QUANTITY_PER_ITEM, item.quantity + 1))}
                disabled={item.quantity >= MAX_QUANTITY_PER_ITEM}
                aria-label="Tambah jumlah"
                className="flex h-6 w-6 items-center justify-center rounded-r-lg transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            <p className="text-sm font-bold tabular-nums">{formatRupiah(harga * item.quantity)}</p>
          </div>

          {/* Artinya ditulis di bawah namanya. "Tukar" sendirian tidak
              membedakan dirinya dari barang tambahan, dan itu justru pasangan
              yang paling sering tertukar (docs/11 §2) — pasangan kalimat ini
              ("dipasang bersamaan" vs "pelanggan pilih salah satu") dipakai
              sama di keterangan baris dan di kotak varian. */}
          <button
            type="button"
            onClick={onBukaTukar}
            className="flex w-full flex-col items-center gap-0.5 rounded-lg border border-dashed px-2 py-1 text-muted-foreground transition-colors hover:border-brand-green hover:text-brand-green"
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
              <Shuffle className="h-3 w-3" />
              Pilihan tukar
              {jumlahTukar > 0 && (
                <span className="rounded-full bg-brand-green/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-green">
                  {jumlahTukar}
                </span>
              )}
            </span>
            <span className="text-[10px] leading-none">pelanggan pilih salah satu</span>
          </button>
        </div>
      )}
    </div>
  )
}
