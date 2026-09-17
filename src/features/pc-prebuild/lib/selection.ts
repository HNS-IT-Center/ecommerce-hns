import { applicablePrebuildDiscount } from "@/lib/pc-prebuild/discount"
import type { CartItem } from "@/store/cart"

import type { PrebuildComponent, PrebuildOption, PrebuildView } from "./types"

/**
 * Pilihan pelanggan atas barang-barang yang bisa ditukar, dikunci
 * `PrebuildComponent.key` → `optionId()` pilihan yang dipilih.
 *
 * Yang disimpan id, BUKAN indeks pilihan — aturan yang sama dengan `?pick=` di
 * URL (docs/11-pc-prebuild.md §5). Indeks berkhianat diam-diam begitu staff
 * mengurutkan ulang pilihan di panel admin.
 *
 * Kunci yang tidak ada di `selection`, atau yang menunjuk produk yang bukan
 * salah satu pilihan barang itu, JATUH KE BAWAAN — bukan dipaksakan masuk.
 */
export type PrebuildSelection = Record<string, number>

/**
 * Identitas satu pilihan: variannya kalau ada, kalau tidak produknya sendiri.
 *
 * BUKAN `productId`. Sejak chip varian multi-select (16 Sep 2026) dua pilihan
 * bisa menunjuk induk yang sama — "SSD 1TB atau 2TB" — dan membedakannya lewat
 * `productId` membuat kedua tombol menyala bersamaan, sementara yang masuk
 * keranjang selalu varian pertama. Baris varian juga sebuah `Product`, jadi id-nya
 * tidak mungkin bertabrakan dengan id produk lain.
 */
export function optionId(option: { productId: number; variationId?: number }): number {
  return option.variationId ?? option.productId
}

/** Bawaan = pilihan pertama. `null` hanya kalau seluruh pilihannya hilang. */
export function chosenOption(
  component: PrebuildComponent,
  selection: PrebuildSelection
): PrebuildOption | null {
  const diminta = selection[component.key]
  const cocok = component.options.find((o) => optionId(o) === diminta)
  return cocok ?? component.options[0] ?? null
}

export type ChosenComponent = { component: PrebuildComponent; option: PrebuildOption }

/** Barang yang benar-benar dipakai. Yang hilang dari katalog tidak ikut. */
export function chosenComponents(
  view: PrebuildView,
  selection: PrebuildSelection
): ChosenComponent[] {
  return view.components
    .map((component) => ({ component, option: chosenOption(component, selection) }))
    .filter((c): c is ChosenComponent => c.option !== null)
}

/**
 * Total menurut pilihan yang sedang aktif.
 *
 * Ini PENJUMLAHAN harga satuan yang dikirim server dari katalog — bukan harga
 * yang diturunkan dari rumus. Bedanya ditegaskan di docs/11-pc-prebuild.md §3
 * dan CLAUDE.md §2.7; pengamannya tetap di server, karena `priceCartFromCatalog`
 * menghitung ulang seluruhnya saat memesan.
 */
export function selectionTotal(view: PrebuildView, selection: PrebuildSelection): number {
  return chosenComponents(view, selection).reduce(
    (total, { option }) => total + option.price * option.quantity,
    0
  )
}

export type PackagePrice = {
  /** Penjumlahan harga katalog komponen. */
  normal: number
  /** Potongan paket yang benar-benar berlaku terhadap `normal`; 0 = tidak ada. */
  discount: number
  /** Yang dibayar pelanggan. */
  final: number
}

/**
 * Harga satu paket dari total normalnya.
 *
 * SATU-SATUNYA tempat potongan paket dikurangkan di sisi klien — kartu, halaman
 * detail, dan PDF semuanya lewat sini, dan keranjang lewat rumus yang sama di
 * `lib/pc-prebuild/discount.ts`. Potongan adalah data yang ditetapkan staff,
 * bukan angka yang dikarang (CLAUDE.md §2.7).
 */
export function packagePrice(view: Pick<PrebuildView, "discount">, normal: number): PackagePrice {
  const discount = applicablePrebuildDiscount(view.discount, normal)
  return { normal, discount, final: normal - discount }
}

/** Harga paket menurut pilihan yang sedang aktif. */
export function selectionPrice(view: PrebuildView, selection: PrebuildSelection): PackagePrice {
  return packagePrice(view, selectionTotal(view, selection))
}

/**
 * Kunci satu paket DI KERANJANG.
 *
 * Ikut menyertakan kombinasi pilihan, jadi paket yang sama dengan RAM 16GB dan
 * dengan RAM 32GB berdiri sebagai dua blok terpisah. Pelanggan yang sengaja
 * membandingkan dua konfigurasi tidak kehilangan salah satunya, dan CS tidak
 * pernah menerima dua paket yang salah satunya tidak pernah dipilih siapa pun.
 */
export function bundleKey(view: PrebuildView, selection: PrebuildSelection): string {
  const pilihan = chosenComponents(view, selection).map(({ option }) => optionId(option))
  return `${view.id}|${pilihan.join("-")}`
}

/**
 * Satu paket → baris-baris keranjang.
 *
 * Tiap komponen tetap baris tersendiri dengan `productId` katalog yang
 * sungguhan; yang membuatnya satu kesatuan adalah `bundle` yang menempel di
 * tiap baris. Lihat catatan panjang di `CartBundleRef` (store/cart.ts).
 *
 * `price` diisi harga katalog yang sedang tampil. Ia TIDAK dipakai menghitung
 * apa pun saat memesan — server membacanya ulang — tapi ia yang dibandingkan
 * supaya perubahan harga bisa ditunjukkan ke pelanggan.
 */
export function toCartLines(
  view: PrebuildView,
  selection: PrebuildSelection,
  bundleQuantity = 1
): CartItem[] {
  const key = bundleKey(view, selection)

  return chosenComponents(view, selection).map(({ option }) => ({
    // Segmen ketiga membuat komponen yang sama bisa hidup di dua paket
    // sekaligus, atau di sebuah paket sekaligus berdiri sendiri di keranjang.
    id: `${option.productId}_${option.variationId ?? ""}_b${key}`,
    productId: option.productId,
    name: option.name,
    price: option.price,
    ...(option.image ? { image: option.image } : {}),
    quantity: option.quantity * bundleQuantity,
    ...(option.variationLabel ? { variationLabel: option.variationLabel } : {}),
    bundle: {
      key,
      presetId: view.id,
      name: view.name,
      unitQuantity: option.quantity,
      quantity: bundleQuantity,
      ...(view.discount > 0 ? { discount: view.discount } : {}),
    },
  }))
}

/**
 * Tautan ke wizard PC Builder dengan pilihan pelanggan ikut terbawa.
 *
 * Yang dicantumkan hanya barang yang PUNYA pilihan tukar: barang tanpa cabang
 * toh cuma punya satu kemungkinan, dan menyebutnya lagi hanya memanjangkan URL
 * yang beredar lewat WhatsApp.
 *
 * Bentuknya `stepId:optionId`, bukan indeks — lihat catatan panjang di
 * `/build-pc` page.tsx.
 */
export function builderUrl(view: PrebuildView, selection: PrebuildSelection): string {
  const pick = pickParam(view, selection)
  const dasar = `/build-pc?preset=${encodeURIComponent(view.id)}`
  return pick ? `${dasar}&pick=${encodeURIComponent(pick)}` : dasar
}

/**
 * Tautan ke lembar cetak PDF paket dengan pilihan pelanggan ikut terbawa.
 *
 * `?pick=` berbentuk SAMA dengan milik `builderUrl`, jadi satu pembaca
 * (`selectionFromPick`) melayani keduanya.
 */
export function printUrl(view: PrebuildView, selection: PrebuildSelection): string {
  const pick = pickParam(view, selection)
  const dasar = `/pc-prebuild/${encodeURIComponent(view.id)}/print`
  return pick ? `${dasar}?pick=${encodeURIComponent(pick)}` : dasar
}

/** `stepId:optionId,…` untuk barang yang punya pilihan tukar saja. */
function pickParam(view: PrebuildView, selection: PrebuildSelection): string {
  return chosenComponents(view, selection)
    .filter(({ component }) => component.branching)
    .map(({ component, option }) => `${component.stepId}:${optionId(option)}`)
    .join(",")
}

/**
 * `?pick=` → pilihan. Kebalikan `pickParam`, dengan aturan pencocokan yang sama
 * dengan `/build-pc` page.tsx:
 *
 * - id dicocokkan ke `optionId()` lebih dulu, lalu ke `productId` — tautan lama
 *   yang membawa id induk jatuh ke varian pertama produk itu;
 * - id yang bukan salah satu pilihan barangnya diabaikan, jadi barangnya jatuh
 *   ke bawaan. URL bisa disunting siapa saja; yang bisa dipilih lewat URL hanya
 *   yang memang ditawarkan staff.
 */
export function selectionFromPick(view: PrebuildView, raw: string | undefined): PrebuildSelection {
  const diminta = new Map<string, Set<number>>()
  for (const bagian of (raw ?? "").split(",").slice(0, 50)) {
    const [stepId, mentah] = bagian.split(":")
    const id = Number(mentah)
    if (!stepId || !Number.isSafeInteger(id) || id <= 0) continue
    const set = diminta.get(stepId) ?? new Set<number>()
    set.add(id)
    diminta.set(stepId, set)
  }

  const selection: PrebuildSelection = {}
  for (const component of view.components) {
    const ids = diminta.get(component.stepId)
    if (!ids || !component.branching) continue
    const cocok =
      component.options.find((o) => ids.has(optionId(o))) ??
      component.options.find((o) => ids.has(o.productId))
    if (cocok) selection[component.key] = optionId(cocok)
  }
  return selection
}
