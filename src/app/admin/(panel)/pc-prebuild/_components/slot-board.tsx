"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  Loader2,
  Minus,
  Package,
  Plus,
  Replace,
  Search,
  Shuffle,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildAlternative, PcPrebuildItem } from "@/lib/pc-prebuild/config"
import {
  MAX_ALTERNATIVES_PER_ITEM,
  MAX_ITEMS_PER_SLOT,
  MAX_QUANTITY_PER_ITEM,
} from "@/lib/pc-prebuild/limits"
import type { PrebuildPickerProduct } from "@/lib/pc-prebuild/products"
import { formatRupiah } from "@/lib/utils"

import { searchPrebuildProductsAction } from "../actions"

/**
 * Pemilih komponen untuk satu langkah PC Builder.
 *
 * ## Dua hal yang sering tertukar
 *
 * - **Barang (`items`)** — terpasang BERSAMAAN. Dua NVMe berbeda adalah dua
 *   barang, dan dua-duanya ikut dalam rakitan serta dalam total.
 * - **Pilihan tukar (`alternatives`)** — pelanggan memilih SALAH SATU. Barang
 *   itu sendiri adalah bawaannya.
 *
 * UI-nya sengaja memisahkan keduanya secara visual: barang adalah kartu
 * setingkat, pilihan tukar tersembunyi di dalam kartu barangnya. Panel
 * sebelumnya menyatukan keduanya sebagai satu daftar "pilihan", dan akibatnya
 * tidak ada cara menyatakan "pakai dua SSD sekaligus" sama sekali.
 *
 * ## `allowMultiple` dihormati di sini, bukan di parser
 *
 * `PcBuilderStepConfig.allowMultiple` adalah aturan milik PC Builder tentang
 * boleh-tidaknya satu langkah diisi lebih dari satu barang. Panel ini
 * mematuhinya dengan menonaktifkan tombol "Tambah barang". Parser TIDAK ikut
 * menegakkannya — sakelar itu bisa dimatikan staff kapan saja di halaman lain,
 * dan parser yang mematuhinya akan diam-diam menghapus komponen dari paket yang
 * sudah tersusun.
 */

type Props = {
  step: PcBuilderStepConfig
  items: PcPrebuildItem[]
  onChange: (items: PcPrebuildItem[]) => void
  /** Produk yang sudah dikenal — hasil pramuat server plus hasil pencarian. */
  katalog: Map<number, PrebuildPickerProduct>
  /** Dipanggil saat pencarian membawa produk baru, supaya katalognya tumbuh. */
  onLearn: (products: PrebuildPickerProduct[]) => void
  /** Sisa jatah barang bercabang di seluruh paket. 0 = tidak boleh menambah lagi. */
  branchingLeft: number
  /**
   * Nilai atribut yang wajib dipenuhi produk di langkah ini — hasil aturan
   * `dependSteps`/`dependAttributes` milik PC Builder, dihitung di
   * `preset-editor.tsx`. Kosong = langkah ini tidak bergantung pada langkah mana
   * pun, atau langkah yang digantunginya belum diisi.
   */
  requiredAttributeValueIds: number[]
}

export function SlotBoard({
  step,
  items,
  onChange,
  katalog,
  onLearn,
  branchingLeft,
  requiredAttributeValueIds,
}: Props) {
  const bolehTambah =
    items.length < MAX_ITEMS_PER_SLOT && (step.allowMultiple === true || items.length === 0)

  function ubahItem(index: number, patch: Partial<PcPrebuildItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function tambahBarang() {
    // productId 0 = penampung sementara. Parser membuang baris yang tidak
    // pernah diisi, jadi kartu kosong yang ditinggalkan staff tidak akan
    // tersimpan sebagai komponen hantu.
    onChange([...items, { productId: 0, quantity: 1, alternatives: [] }])
  }

  return (
    // `min-w-0` WAJIB: kartu ini anak sebuah grid, dan anak grid bawaannya
    // `min-width: auto` — ia menolak menyusut di bawah lebar isinya, jadi satu
    // baris panjang di dalamnya melebarkan KOLOMNYA dan menjebol halaman.
    <section className="min-w-0 rounded-2xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{step.name}</h3>
          <p className="text-xs text-muted-foreground">
            {items.length === 0
              ? "Belum ada komponen"
              : `${items.length} barang${step.allowMultiple ? ` · maks ${MAX_ITEMS_PER_SLOT}` : ""}`}
          </p>
        </div>

        <button
          type="button"
          onClick={tambahBarang}
          disabled={!bolehTambah}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40"
          title={
            step.allowMultiple !== true && items.length > 0
              ? `Langkah "${step.name}" disetel hanya boleh satu barang di PC Builder`
              : undefined
          }
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah barang
        </button>
      </header>

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Langkah ini belum dipakai paket. Tekan{" "}
          <span className="font-semibold">Tambah barang</span> untuk mengisinya.
        </p>
      ) : (
        <div className="divide-y">
          {items.map((item, index) => (
            <ItemRow
              key={`${step.id}-${index}`}
              step={step}
              item={item}
              katalog={katalog}
              onLearn={onLearn}
              branchingLeft={branchingLeft}
              requiredAttributeValueIds={requiredAttributeValueIds}
              onChange={(patch) => ubahItem(index, patch)}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** Satu barang: produknya, variannya, jumlahnya, dan pilihan tukarnya. */
function ItemRow({
  step,
  item,
  katalog,
  onLearn,
  branchingLeft,
  requiredAttributeValueIds,
  onChange,
  onRemove,
}: {
  step: PcBuilderStepConfig
  item: PcPrebuildItem
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  branchingLeft: number
  requiredAttributeValueIds: number[]
  onChange: (patch: Partial<PcPrebuildItem>) => void
  onRemove: () => void
}) {
  const [bukaTukar, setBukaTukar] = useState(false)

  const produk = katalog.get(item.productId) ?? null
  const varian = produk?.variations.find((v) => v.id === item.variationId) ?? null

  // Harga yang berlaku: variannya kalau ada, kalau tidak produknya sendiri.
  // Induk VARIABLE sering berharga nol — memakai harganya akan membuat total
  // paket terlihat jauh lebih murah daripada yang sebenarnya.
  const harga = varian ? varian.price : (produk?.price ?? 0)
  const stok = varian ? varian.stock : (produk?.stock ?? 0)

  function pilihProduk(p: PrebuildPickerProduct) {
    onChange({
      productId: p.id,
      // Produk bervarian LANGSUNG memakai varian pertama, bukan menunggu staff
      // memilih. Induk VARIABLE tidak punya harga sendiri, jadi barang yang
      // "belum dipilih variannya" akan masuk total sebagai nol rupiah — persis
      // jenis angka diam-diam salah yang paling sulit ketahuan.
      variationId: p.variations[0]?.id,
      label: undefined,
    })
  }

  const bolehTukar = item.alternatives.length > 0 || branchingLeft > 0

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ProductPicker
            step={step}
            selected={produk}
            onSelect={pilihProduk}
            onLearn={onLearn}
            requiredAttributeValueIds={requiredAttributeValueIds}
            missingId={item.productId > 0 && !produk ? item.productId : null}
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Hapus barang"
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-sale-red hover:text-sale-red"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {produk && produk.variations.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Varian
          </p>
          <div className="flex flex-wrap gap-1.5">
            {produk.variations.map((v) => {
              const aktif = v.id === item.variationId
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ variationId: v.id })}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    aktif
                      ? "border-brand-green bg-brand-green text-primary-foreground"
                      : "hover:border-brand-green hover:text-brand-green"
                  }`}
                >
                  {/* Label varian bisa panjang ("1TB · Hitam · NVMe Gen4").
                      Dipotong, dan harganya yang TIDAK boleh menyusut — angka
                      yang terpotong separuh lebih buruk daripada nama yang
                      terpotong. */}
                  <span className="min-w-0 truncate">{v.label}</span>
                  <span className={`shrink-0 ${aktif ? "opacity-80" : "text-muted-foreground"}`}>
                    {formatRupiah(v.price)}
                  </span>
                  {v.stock <= 0 && (
                    <span className={`shrink-0 ${aktif ? "opacity-80" : "text-sale-red"}`}>
                      · habis
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {produk && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Jumlah
            </span>
            <div className="flex items-center rounded-lg border">
              <button
                type="button"
                onClick={() => onChange({ quantity: Math.max(1, item.quantity - 1) })}
                disabled={item.quantity <= 1}
                aria-label="Kurangi jumlah"
                className="flex h-8 w-8 items-center justify-center rounded-l-lg transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-9 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ quantity: Math.min(MAX_QUANTITY_PER_ITEM, item.quantity + 1) })
                }
                disabled={item.quantity >= MAX_QUANTITY_PER_ITEM}
                aria-label="Tambah jumlah"
                className="flex h-8 w-8 items-center justify-center rounded-r-lg transition-colors hover:bg-muted disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Subtotal</p>
            <p className="font-bold tabular-nums">{formatRupiah(harga * item.quantity)}</p>
          </div>
        </div>
      )}

      {produk && stok <= 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-warning/5 px-2.5 py-2 text-xs text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Stok kosong. Paket tetap bisa disimpan — pelanggan bisa menukarnya di PC Builder.
        </p>
      )}

      {/* Pilihan tukar sengaja TERSEMBUNYI di balik satu klik. Tampilan untuk
          pelanggan belum dirancang ulang, jadi ia belum berpengaruh apa-apa di
          luar panel ini — menampilkannya sejajar dengan jumlah akan membuatnya
          terlihat sepenting jumlah. */}
      {produk && (
        <div className="rounded-lg border border-dashed">
          <button
            type="button"
            onClick={() => setBukaTukar((b) => !b)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Shuffle className="h-3.5 w-3.5" />
              Pilihan tukar
              {item.alternatives.length > 0 && (
                <span className="rounded-full bg-brand-green/10 px-1.5 py-0.5 text-[10px] text-brand-green">
                  {item.alternatives.length}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${bukaTukar ? "rotate-180" : ""}`}
            />
          </button>

          {bukaTukar && (
            <div className="space-y-2 border-t px-3 py-3">
              <p className="text-[11px] text-muted-foreground">
                Komponen pengganti yang boleh dipilih pelanggan. Tampilan untuk pelanggan belum
                dibuat — isinya tersimpan dan siap dipakai nanti.
              </p>

              {item.alternatives.map((alt, i) => (
                <AlternativeRow
                  key={`${alt.productId}-${i}`}
                  step={step}
                  alt={alt}
                  katalog={katalog}
                  onLearn={onLearn}
                  requiredAttributeValueIds={requiredAttributeValueIds}
                  onChange={(patch) =>
                    onChange({
                      alternatives: item.alternatives.map((a, j) =>
                        j === i ? { ...a, ...patch } : a
                      ),
                    })
                  }
                  onRemove={() =>
                    onChange({ alternatives: item.alternatives.filter((_, j) => j !== i) })
                  }
                />
              ))}

              <button
                type="button"
                onClick={() =>
                  onChange({
                    alternatives: [...item.alternatives, { productId: 0, quantity: item.quantity }],
                  })
                }
                disabled={!bolehTukar || item.alternatives.length >= MAX_ALTERNATIVES_PER_ITEM}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors hover:border-brand-green hover:text-brand-green disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah pilihan
              </button>

              {!bolehTukar && item.alternatives.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Jatah komponen bercabang untuk paket ini sudah habis.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AlternativeRow({
  step,
  alt,
  katalog,
  onLearn,
  requiredAttributeValueIds,
  onChange,
  onRemove,
}: {
  step: PcBuilderStepConfig
  alt: PcPrebuildAlternative
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  requiredAttributeValueIds: number[]
  onChange: (patch: Partial<PcPrebuildAlternative>) => void
  onRemove: () => void
}) {
  const produk = katalog.get(alt.productId) ?? null

  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2">
      <div className="min-w-0 flex-1">
        <ProductPicker
          step={step}
          selected={produk}
          compact
          onSelect={(p) => onChange({ productId: p.id, variationId: p.variations[0]?.id })}
          onLearn={onLearn}
          requiredAttributeValueIds={requiredAttributeValueIds}
          missingId={alt.productId > 0 && !produk ? alt.productId : null}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Hapus pilihan"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-sale-red hover:text-sale-red"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/**
 * Pencari produk untuk satu langkah.
 *
 * Mencari lewat server action yang IKUT membawa produk bertipe VARIABLE — beda
 * dari `fetchBuilderProducts` milik wizard yang mengunci `type: "SIMPLE"`.
 * Lihat `lib/pc-prebuild/products.ts`.
 *
 * ## Pilihan lama TIDAK dilepas saat pencarian dibuka
 *
 * Versi pertama mengganti baris produk terpilih dengan kotak pencarian, jadi
 * membuka pencarian sama artinya dengan membatalkan pilihan: staff yang cuma
 * ingin MELIHAT pilihan lain harus memilih ulang produk yang tadi sudah benar,
 * dan yang menutup pencarian tanpa memilih kehilangan pilihannya.
 *
 * Sekarang baris produk terpilih tetap terlihat, dan pencarian muncul sebagai
 * lapisan di bawahnya. Yang menggantikan pilihan hanyalah pilihan lain —
 * menutup pencarian tidak mengubah apa pun.
 *
 * ## Aturan atribut PC Builder ikut ditegakkan
 *
 * `requiredAttributeValueIds` datang dari `dependSteps`/`dependAttributes`
 * langkah ini. Begitu prosesor AM4 dipilih, langkah Motherboard hanya
 * menampilkan mainboard AM4 — sama persis seperti yang dialami pelanggan di
 * wizard. Perubahannya ikut memicu pencarian ulang, jadi mengganti prosesor
 * langsung menyempitkan daftar mainboard.
 */
function ProductPicker({
  step,
  selected,
  onSelect,
  onLearn,
  requiredAttributeValueIds,
  missingId,
  compact = false,
}: {
  step: PcBuilderStepConfig
  selected: PrebuildPickerProduct | null
  onSelect: (product: PrebuildPickerProduct) => void
  onLearn: (products: PrebuildPickerProduct[]) => void
  requiredAttributeValueIds: number[]
  /** Id yang tersimpan tapi tidak ada di katalog — produknya sudah dihapus. */
  missingId: number | null
  compact?: boolean
}) {
  // Terbuka sendiri HANYA saat barangnya memang belum punya produk. Barang yang
  // sudah terisi tidak pernah membuka pencarian tanpa diminta.
  const [buka, setBuka] = useState(selected === null && missingId === null)
  const [query, setQuery] = useState("")
  const [hasil, setHasil] = useState<PrebuildPickerProduct[]>([])
  const [memuat, setMemuat] = useState(false)
  const wadah = useRef<HTMLDivElement>(null)

  // Dibandingkan sebagai STRING: array-nya dibuat ulang tiap render di
  // pemanggil walau isinya sama, dan memasukkannya langsung ke daftar
  // ketergantungan membuat pencarian berjalan tanpa henti.
  const syaratKunci = requiredAttributeValueIds.join(",")

  /**
   * Pencarian ditunda 300 ms setelah ketikan berhenti.
   *
   * Tanpa penundaan, mengetik "ryzen" mengirim lima permintaan yang jawabannya
   * bisa tiba tidak berurutan — dan yang terakhir tiba belum tentu yang paling
   * relevan. `batal` menahan hasil permintaan lama supaya tidak menimpa hasil
   * yang lebih baru.
   */
  useEffect(() => {
    if (!buka) return

    let batal = false
    const timer = setTimeout(async () => {
      setMemuat(true)
      try {
        const { products } = await searchPrebuildProductsAction({
          categoryIds: step.categoryIds ?? [],
          requiredAttributeValueIds: syaratKunci ? syaratKunci.split(",").map(Number) : [],
          searchQuery: query,
          limit: 12,
        })
        if (batal) return
        setHasil(products)
        onLearn(products)
      } finally {
        if (!batal) setMemuat(false)
      }
    }, 300)

    return () => {
      batal = true
      clearTimeout(timer)
    }
    // `onLearn` sengaja tidak masuk daftar — lihat catatan `syaratKunci`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, query, step.categoryIds, syaratKunci])

  // Klik di luar menutup daftar. Tanpa ini, membuka pencarian di beberapa
  // barang sekaligus menghasilkan beberapa daftar panjang yang saling menutupi.
  useEffect(() => {
    if (!buka) return
    function tutup(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false)
    }
    document.addEventListener("mousedown", tutup)
    return () => document.removeEventListener("mousedown", tutup)
  }, [buka])

  return (
    <div ref={wadah} className="relative">
      {/* Baris produk terpilih — SELALU dirender, termasuk saat pencarian
          terbuka. Inilah yang membuat membuka pencarian tidak lagi sama dengan
          membatalkan pilihan. */}
      <button
        type="button"
        onClick={() => setBuka((b) => !b)}
        className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-brand-green ${
          buka ? "border-brand-green" : ""
        }`}
      >
        {selected?.image ? (
          <Image
            src={selected.image}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-md border bg-white object-contain"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
            <Package className="h-4 w-4" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className={`block truncate font-semibold ${compact ? "text-xs" : "text-sm"}`}>
                {selected.name}
              </span>
              <span className="block text-xs">
                <span className="font-bold text-sale-red">{formatRupiah(selected.price)}</span>
                {selected.variations.length > 0 && (
                  <span className="text-muted-foreground"> · {selected.variations.length} varian</span>
                )}
              </span>
            </>
          ) : missingId !== null ? (
            <span className="block text-sm font-semibold text-sale-red">
              Produk #{missingId} tidak ada di katalog
            </span>
          ) : (
            <span className="block text-sm font-semibold text-muted-foreground">
              Pilih produk untuk {step.name}
            </span>
          )}
        </span>

        <Replace className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {buka && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cari produk untuk ${step.name}…`}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {memuat && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>

          {requiredAttributeValueIds.length > 0 && (
            <p className="border-b bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
              Disaring mengikuti aturan PC Builder — hanya produk yang cocok dengan komponen di
              langkah sebelumnya.
            </p>
          )}

          <div className="max-h-64 overflow-y-auto">
            {hasil.length === 0 && !memuat ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {requiredAttributeValueIds.length > 0
                  ? "Tidak ada produk yang cocok dengan komponen yang sudah dipilih."
                  : query
                    ? "Tidak ada produk yang cocok."
                    : "Ketik untuk mencari."}
              </p>
            ) : (
              hasil.map((p) => {
                const terpilih = selected?.id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p)
                      setBuka(false)
                      setQuery("")
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
                      terpilih ? "bg-brand-green/10" : ""
                    }`}
                  >
                    {p.image ? (
                      <Image
                        src={p.image}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded border bg-white object-contain"
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border bg-muted text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{p.name}</span>
                      <span className="block text-[11px]">
                        <span className="font-bold text-sale-red">
                          {p.variations.length > 0
                            ? `mulai ${formatRupiah(Math.min(...p.variations.map((v) => v.price)))}`
                            : formatRupiah(p.price)}
                        </span>
                        {p.variations.length > 0 && (
                          <span className="text-muted-foreground"> · {p.variations.length} varian</span>
                        )}
                        {p.stock <= 0 && <span className="text-muted-foreground"> · stok habis</span>}
                      </span>
                    </span>
                    {terpilih && (
                      <span className="shrink-0 text-[10px] font-bold uppercase text-brand-green">
                        dipakai
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
