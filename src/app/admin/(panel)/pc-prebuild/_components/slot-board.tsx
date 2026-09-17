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
import type { PrebuildPickerProduct, PrebuildVariation } from "@/lib/pc-prebuild/products"
import { formatRupiah } from "@/lib/utils"

import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
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
  requiredAttributeValueGroups: AttributeRequirementGroup[]
}

export function SlotBoard({
  step,
  items,
  onChange,
  katalog,
  onLearn,
  branchingLeft,
  requiredAttributeValueGroups,
}: Props) {
  const bolehTambah =
    items.length < MAX_ITEMS_PER_SLOT && (step.allowMultiple === true || items.length === 0)

  /**
   * Kunci tiap barang di slot ini. Dipakai dua hal: menandai baris yang akan
   * dibuang parser, dan mematikan chip varian yang akan menghasilkan baris
   * kembar.
   *
   * Barisan penilaiannya menyalin `rapikanItems`: yang muncul PERTAMA bertahan,
   * yang berikutnya dengan kunci sama yang dibuang. Jadi yang ditandai adalah
   * baris belakangan, bukan dua-duanya — menandai keduanya akan menyuruh staff
   * membetulkan baris yang sebenarnya aman.
   *
   * Baris kosong (`productId` 0) tidak ikut: ia penampung sementara yang memang
   * mati di parser, dan menandainya kembar cuma bising.
   */
  const kunciItems = items.map(kunciBarang)

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
              requiredAttributeValueGroups={requiredAttributeValueGroups}
              duplicate={item.productId > 0 && kunciItems.indexOf(kunciItems[index]) < index}
              takenKeys={
                new Set(
                  kunciItems.filter((_, j) => j !== index && items[j].productId > 0)
                )
              }
              onChange={(patch) => ubahItem(index, patch)}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Kunci identitas satu barang — HARUS sama persis dengan `kunciBarang` di
 * [`lib/pc-prebuild/config.ts`](../../../../../lib/pc-prebuild/config.ts).
 *
 * Parser membuang baris yang kuncinya kembar saat menyimpan (`rapikanItems` dan
 * `rapikanAlternatives`). Panel memakai kunci yang sama supaya kejadian itu
 * terlihat SEBELUM tombol simpan ditekan — sebelumnya pembuangannya tanpa
 * jejak: staff menyusun dua pilihan, menyimpan, dan yang kembali cuma satu.
 *
 * Kalau rumus kunci di parser berubah, ubah juga di sini. Dua rumus yang
 * berbeda lebih buruk daripada tidak ada peringatan sama sekali: panel akan
 * menenangkan staff tentang baris yang tetap dibuang.
 */
function kunciBarang(ref: { productId: number; variationId?: number }): string {
  return `${ref.productId}~${ref.variationId ?? 0}`
}

/**
 * Varian bawaan saat sebuah produk baru dipilih: varian pertama yang BELUM
 * dipakai baris lain di lingkup yang sama.
 *
 * Memakai `variations[0]` apa adanya membuat baris kedua dari produk yang sama
 * selalu lahir kembar dengan baris pertama, lalu dibuang saat simpan — itulah
 * yang membuat "SSD 1TB atau 2TB" sebagai pilihan tukar tidak bisa dinyatakan
 * sama sekali.
 *
 * Kalau semua variannya sudah terpakai, tetap kembalikan yang pertama:
 * barisnya akan ditandai kembar dan staff yang memutuskan, bukan panel yang
 * diam-diam menolak memilih apa pun. Barang tanpa varian mengembalikan
 * `undefined` — induk SIMPLE memang tidak punya varian.
 */
function varianBawaan(
  p: PrebuildPickerProduct,
  terpakai: Set<string>
): number | undefined {
  const bebas = p.variations.find(
    (v) => !terpakai.has(kunciBarang({ productId: p.id, variationId: v.id }))
  )
  return (bebas ?? p.variations[0])?.id
}

/**
 * Peringatan baris kembar. Nadanya sengaja merah, bukan kuning seperti stok
 * kosong: stok kosong tetap tersimpan, baris kembar TIDAK.
 */
function DuplicateWarning({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-sale-red/5 px-2.5 py-2 text-xs text-sale-red">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  )
}

/**
 * Pemilih varian — dipakai barang UTAMA maupun pilihan tukar.
 *
 * Dulu hanya barang utama yang punya pemilih ini; pilihan tukar mengunci
 * `variations[0]` tanpa cara mengubahnya, jadi paket tidak bisa menawarkan
 * "1TB atau 2TB" dari produk yang sama. Satu komponen untuk dua tempat supaya
 * keduanya tidak menyimpang lagi.
 *
 * Varian yang kuncinya sudah dipakai baris lain DIMATIKAN, bukan sekadar
 * ditandai: memilihnya cuma akan menghasilkan baris yang dibuang parser.
 */
function VariantChips({
  productId,
  variations,
  selectedIds,
  defaultId,
  canAdd,
  takenKeys,
  onToggle,
  compact = false,
}: {
  productId: number
  variations: PrebuildVariation[]
  /** Varian yang sedang ditawarkan. Tidak pernah kosong selama produknya terpilih. */
  selectedIds: number[]
  /**
   * Varian yang jadi BAWAAN — hanya untuk produk utama. Kelompok pilihan tukar
   * tidak punya bawaan: seluruh isinya memang pilihan.
   */
  defaultId?: number
  /** Jatah pilihan masih ada. Kalau habis, varian yang belum aktif dimatikan. */
  canAdd: boolean
  /** Kunci milik baris LAIN di lingkup yang sama. Kunci baris ini sendiri tidak ikut. */
  takenKeys: Set<string>
  onToggle: (variationId: number) => void
  compact?: boolean
}) {
  return (
    <div>
      <p
        className={`mb-1.5 font-semibold uppercase tracking-wide text-muted-foreground ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        Varian
      </p>
      <div className="flex flex-wrap gap-1.5">
        {variations.map((v) => {
          const aktif = selectedIds.includes(v.id)
          const bawaan = v.id === defaultId
          const terpakai =
            !aktif && takenKeys.has(kunciBarang({ productId, variationId: v.id }))

          // Varian terakhir tidak boleh dimatikan: produk tanpa varian terpilih
          // masuk total sebagai harga induk, yang untuk VARIABLE sering nol.
          const terakhir = aktif && selectedIds.length <= 1
          const jatahHabis = !aktif && !canAdd
          const mati = terpakai || terakhir || jatahHabis

          return (
            <button
              key={v.id}
              type="button"
              disabled={mati}
              aria-pressed={aktif}
              title={
                terpakai
                  ? "Varian ini sudah dipakai baris lain di langkah yang sama"
                  : terakhir
                    ? "Minimal satu varian harus ditawarkan"
                    : jatahHabis
                      ? "Jatah pilihan untuk barang ini sudah penuh"
                      : undefined
              }
              onClick={() => onToggle(v.id)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-semibold transition-colors ${
                compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
              } ${
                aktif
                  ? "border-brand-green bg-brand-green text-primary-foreground"
                  : mati
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-brand-green hover:text-brand-green"
              } ${terakhir ? "cursor-not-allowed" : ""}`}
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
              {bawaan && <span className="shrink-0 opacity-80">· bawaan</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Satu barang: produknya, variannya, jumlahnya, dan pilihan tukarnya. */
function ItemRow({
  step,
  item,
  katalog,
  onLearn,
  branchingLeft,
  requiredAttributeValueGroups,
  duplicate,
  takenKeys,
  onChange,
  onRemove,
}: {
  step: PcBuilderStepConfig
  item: PcPrebuildItem
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  branchingLeft: number
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  /** Barang ini sama persis dengan barang lain yang lebih dulu di slot yang sama. */
  duplicate: boolean
  /** Kunci barang LAIN di slot yang sama. */
  takenKeys: Set<string>
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
      // Produk bervarian LANGSUNG memakai salah satu variannya, bukan menunggu
      // staff memilih. Induk VARIABLE tidak punya harga sendiri, jadi barang
      // yang "belum dipilih variannya" akan masuk total sebagai nol rupiah —
      // persis jenis angka diam-diam salah yang paling sulit ketahuan.
      // Yang dipakai adalah varian pertama yang belum diambil baris lain; lihat
      // `varianBawaan`.
      variationId: varianBawaan(p, takenKeys),
      label: undefined,
    })
  }

  const bolehTukar = item.alternatives.length > 0 || branchingLeft > 0

  /**
   * Jatah pilihan masih tersisa. Dua syarat, bukan satu: jumlahnya belum
   * mentok, DAN barang ini boleh bercabang sama sekali (`MAX_BRANCHING_ITEMS`
   * dihitung per paket, bukan per barang).
   */
  const bolehTambahPilihan =
    item.alternatives.length < MAX_ALTERNATIVES_PER_ITEM && bolehTukar

  /**
   * Lingkup pilihan tukar. Barangnya SENDIRI ikut dihitung, karena
   * `rapikanAlternatives` membuang pilihan yang sama dengan barangnya — pilihan
   * tukar yang identik dengan bawaannya bukan pilihan.
   */
  const kunciItemIni = kunciBarang(item)

  /**
   * Varian produk UTAMA yang sedang ditawarkan, bawaan lebih dulu.
   *
   * Ini inti Opsi A: "beberapa varian aktif" bukan bentuk data baru, melainkan
   * cara lain membaca bentuk yang sudah ada — `variationId` barangnya plus
   * `alternatives` yang menunjuk produk yang SAMA. Pelanggan menerimanya sebagai
   * `options` biasa lewat `toComponent` di `features/pc-prebuild/lib/to-view.ts`,
   * jadi tidak ada satu pun pembaca hilir yang perlu tahu soal pengelompokan
   * ini.
   */
  const varianUtamaAktif: number[] = [
    ...(item.variationId ? [item.variationId] : []),
    ...item.alternatives
      .filter((a) => a.productId === item.productId && a.variationId)
      .map((a) => a.variationId as number),
  ]

  /**
   * Pilihan tukar yang menunjuk produk LAIN, dikelompokkan per produk.
   *
   * Satu produk = satu baris, dan chip di baris itu menentukan varian mana saja
   * dari produk tersebut yang ditawarkan. Tanpa pengelompokan, tiga varian dari
   * satu SSD tampil sebagai tiga baris produk yang kelihatan berbeda padahal
   * barangnya sama — dan staff harus mengganti produknya tiga kali untuk
   * menukar satu tawaran.
   *
   * Varian produk utama TIDAK ikut ke sini: ia sudah diwakili chip di atas.
   * Menampilkannya dua kali berarti dua tempat mengubah data yang sama.
   */
  const kelompokTukar: { productId: number; variationIds: (number | undefined)[] }[] = []
  for (const alt of item.alternatives) {
    if (alt.productId === item.productId) continue
    const ada = kelompokTukar.find((g) => g.productId === alt.productId)
    if (ada) ada.variationIds.push(alt.variationId)
    else kelompokTukar.push({ productId: alt.productId, variationIds: [alt.variationId] })
  }

  /** Nyalakan/matikan satu varian produk utama. */
  function ubahVarianUtama(vId: number) {
    const aktif = varianUtamaAktif.includes(vId)

    if (!aktif) {
      if (!bolehTambahPilihan) return
      onChange({
        alternatives: [
          ...item.alternatives,
          { productId: item.productId, variationId: vId, quantity: item.quantity },
        ],
      })
      return
    }

    if (varianUtamaAktif.length <= 1) return

    if (vId !== item.variationId) {
      onChange({
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
    onChange({
      variationId: penerus.variationId,
      alternatives: item.alternatives.filter((a) => a !== penerus),
    })
  }

  /**
   * Pindahkan bawaan. Yang lama TURUN jadi pilihan di posisi yang sama, bukan
   * dibuang: bawaan cuma soal mana yang terpilih duluan di halaman pelanggan.
   */
  function jadikanBawaan(vId: number) {
    if (!item.variationId || vId === item.variationId) return
    const calon = item.alternatives.find(
      (a) => a.productId === item.productId && a.variationId === vId
    )
    if (!calon) return
    onChange({
      variationId: vId,
      alternatives: item.alternatives.map((a) =>
        a === calon ? { ...a, variationId: item.variationId } : a
      ),
    })
  }

  /** Ganti seluruh isi satu kelompok, di posisi yang sama. */
  function gantiKelompok(productIdLama: number, baru: PcPrebuildAlternative[]) {
    const hasil: PcPrebuildAlternative[] = []
    let sudahDisisipkan = false
    for (const a of item.alternatives) {
      if (a.productId !== productIdLama) {
        hasil.push(a)
        continue
      }
      if (!sudahDisisipkan) {
        hasil.push(...baru)
        sudahDisisipkan = true
      }
    }
    onChange({ alternatives: hasil })
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ProductPicker
            step={step}
            selected={produk}
            onSelect={pilihProduk}
            onLearn={onLearn}
            requiredAttributeValueGroups={requiredAttributeValueGroups}
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

      {duplicate && (
        <DuplicateWarning text="Barang ini sama persis dengan barang lain di langkah ini — yang kembar tidak ikut tersimpan. Pilih varian lain, atau hapus salah satunya dan naikkan jumlahnya." />
      )}

      {produk && produk.variations.length > 0 && (
        <div className="space-y-2">
          <VariantChips
            productId={produk.id}
            variations={produk.variations}
            selectedIds={varianUtamaAktif}
            defaultId={item.variationId}
            canAdd={bolehTambahPilihan}
            takenKeys={takenKeys}
            onToggle={ubahVarianUtama}
          />

          {/* Bawaan dipilih lewat select, bukan lewat klik kedua pada chip:
              chip sudah punya satu arti (ditawarkan / tidak), dan menumpuk arti
              kedua di atasnya membuat mematikan varian dan memindah bawaan
              saling tertukar. */}
          {varianUtamaAktif.length > 1 && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bawaan
              </span>
              <select
                value={item.variationId ?? 0}
                onChange={(e) => jadikanBawaan(Number(e.target.value))}
                className="min-w-0 flex-1 rounded-lg border bg-background px-2 py-1 text-xs font-semibold"
              >
                {varianUtamaAktif.map((id) => (
                  <option key={id} value={id}>
                    {produk.variations.find((v) => v.id === id)?.label ?? `#${id}`}
                  </option>
                ))}
              </select>
              <span className="w-full text-[11px] text-muted-foreground">
                Varian yang terpilih duluan di halaman pelanggan, dan yang dipakai total paket.
              </span>
            </label>
          )}
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

      {/* Pilihan tukar sengaja TERSEMBUNYI di balik satu klik: kebanyakan
          komponen tidak punya pilihan tukar, dan menampilkannya sejajar dengan
          jumlah akan membuatnya terlihat sepenting jumlah.

          Sejak 28 Agustus 2026 isinya SUDAH sampai ke pelanggan — `toComponent`
          di `features/pc-prebuild/lib/to-view.ts` merangkai barang beserta
          pilihan tukarnya jadi `options` milik `ComponentPicker`. Keterangan di
          panel ini sempat menyatakan sebaliknya selama berbulan-bulan, yang
          artinya staff diberi tahu bahwa pekerjaannya di sini belum berpengaruh
          padahal sudah dilihat pelanggan. */}
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
                Komponen pengganti yang boleh dipilih pelanggan di halaman paket. Pilihannya ikut
                ke keranjang dan ke PC Builder. Untuk menawarkan ukuran berbeda dari produk yang
                SAMA (misal SSD 1TB atau 2TB), tidak perlu ke sini — nyalakan variannya langsung
                di chip Varian di atas.
              </p>

              {kelompokTukar.map((grup) => (
                <AlternativeGroup
                  key={grup.productId}
                  step={step}
                  productId={grup.productId}
                  variationIds={grup.variationIds}
                  quantity={item.quantity}
                  katalog={katalog}
                  onLearn={onLearn}
                  requiredAttributeValueGroups={requiredAttributeValueGroups}
                  canAdd={bolehTambahPilihan}
                  duplicate={grup.productId > 0 && grup.productId === item.productId}
                  takenKeys={
                    new Set([
                      ...(item.productId > 0 ? [kunciItemIni] : []),
                      ...item.alternatives
                        .filter((a) => a.productId > 0 && a.productId !== grup.productId)
                        .map(kunciBarang),
                    ])
                  }
                  onReplace={(baru) => gantiKelompok(grup.productId, baru)}
                  onRemove={() =>
                    onChange({
                      alternatives: item.alternatives.filter(
                        (a) => a.productId !== grup.productId
                      ),
                    })
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
                disabled={
                  !bolehTambahPilihan || kelompokTukar.some((g) => g.productId === 0)
                }
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

/**
 * Satu PRODUK pengganti, beserta varian-varian yang ditawarkan darinya.
 *
 * Satu baris = satu produk, bukan satu entri `alternatives`. Tiga varian dari
 * satu SSD adalah tiga entri di data, tapi satu baris di sini — kalau tidak,
 * ketiganya tampil sebagai tiga produk yang kelihatan berbeda padahal barangnya
 * sama, dan menukar tawarannya berarti mengganti produk tiga kali.
 *
 * Kelompok ini TIDAK punya bawaan: bawaan hanya ada pada barang utama, dan
 * seluruh isi kelompok ini memang pilihan.
 */
function AlternativeGroup({
  step,
  productId,
  variationIds,
  quantity,
  katalog,
  onLearn,
  requiredAttributeValueGroups,
  canAdd,
  duplicate,
  takenKeys,
  onReplace,
  onRemove,
}: {
  step: PcBuilderStepConfig
  /** 0 = kelompok kosong yang baru ditambahkan, produknya belum dipilih. */
  productId: number
  /** Varian yang ditawarkan dari produk ini. Satu entri `undefined` untuk produk SIMPLE. */
  variationIds: (number | undefined)[]
  /** Jumlah milik barangnya — dipakai saat entri baru dibuat. */
  quantity: number
  katalog: Map<number, PrebuildPickerProduct>
  onLearn: (products: PrebuildPickerProduct[]) => void
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  /** Jatah pilihan untuk barang ini masih ada. */
  canAdd: boolean
  /** Kelompok ini menunjuk produk yang sama dengan barang utamanya. */
  duplicate: boolean
  /** Kunci barang utama dan kelompok lain. */
  takenKeys: Set<string>
  onReplace: (entries: PcPrebuildAlternative[]) => void
  onRemove: () => void
}) {
  const produk = katalog.get(productId) ?? null

  const aktif = variationIds.filter((id): id is number => typeof id === "number")

  function ubahVarian(vId: number) {
    if (aktif.includes(vId)) {
      // Varian terakhir tidak dimatikan lewat chip — menghapus SELURUH kelompok
      // itu tombol tersendiri, supaya "tidak menawarkan produk ini lagi" tidak
      // terjadi tanpa disengaja saat staff cuma mengurangi pilihan.
      if (aktif.length <= 1) return
      onReplace(
        aktif
          .filter((id) => id !== vId)
          .map((id) => ({ productId, variationId: id, quantity }))
      )
      return
    }

    if (!canAdd) return
    onReplace(
      [...aktif, vId].map((id) => ({ productId, variationId: id, quantity }))
    )
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <ProductPicker
            step={step}
            selected={produk}
            compact
            onSelect={(p) =>
              onReplace([
                { productId: p.id, variationId: varianBawaan(p, takenKeys), quantity },
              ])
            }
            onLearn={onLearn}
            requiredAttributeValueGroups={requiredAttributeValueGroups}
            missingId={productId > 0 && !produk ? productId : null}
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

      {duplicate && (
        <DuplicateWarning text="Ini produk yang sama dengan barangnya sendiri — yang kembar tidak ikut tersimpan. Untuk menawarkan varian lain dari produk ini, pakai chip Varian di atas." />
      )}

      {produk && produk.variations.length > 0 && (
        <VariantChips
          compact
          productId={produk.id}
          variations={produk.variations}
          selectedIds={aktif}
          canAdd={canAdd}
          takenKeys={takenKeys}
          onToggle={ubahVarian}
        />
      )}

      {/* Harga tiap varian yang ditawarkan — itulah yang berubah saat pelanggan
          menukarnya. Angkanya datang dari katalog apa adanya; tidak ada
          perkalian atau persentase di sini (CLAUDE.md §2.7). */}
      {produk && (
        <p className="text-right text-[11px] text-muted-foreground">
          <span className="uppercase tracking-wide">Harga satuan</span>{" "}
          <span className="font-bold tabular-nums text-foreground">
            {aktif.length > 0
              ? aktif
                  .map((id) =>
                    formatRupiah(produk.variations.find((v) => v.id === id)?.price ?? 0)
                  )
                  .join(" · ")
              : formatRupiah(produk.price)}
          </span>
        </p>
      )}
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
 * `requiredAttributeValueGroups` datang dari `dependSteps`/`dependAttributes`
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
  requiredAttributeValueGroups,
  missingId,
  compact = false,
}: {
  step: PcBuilderStepConfig
  selected: PrebuildPickerProduct | null
  onSelect: (product: PrebuildPickerProduct) => void
  onLearn: (products: PrebuildPickerProduct[]) => void
  requiredAttributeValueGroups: AttributeRequirementGroup[]
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
  // ketergantungan membuat pencarian berjalan tanpa henti. `|` memisahkan
  // kelompok supaya dua susunan berbeda tidak menghasilkan kunci yang sama.
  const syaratKunci = requiredAttributeValueGroups.map((g) => g.join(",")).join("|")

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
          requiredAttributeValueGroups: syaratKunci
            ? syaratKunci.split("|").map((g) => g.split(",").map(Number))
            : [],
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

          {requiredAttributeValueGroups.length > 0 && (
            <p className="border-b bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground">
              Disaring mengikuti aturan PC Builder — hanya produk yang cocok dengan komponen di
              langkah sebelumnya.
            </p>
          )}

          <div className="max-h-64 overflow-y-auto">
            {hasil.length === 0 && !memuat ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                {requiredAttributeValueGroups.length > 0
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
