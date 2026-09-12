import type { CartItem } from "@/store/cart"

import type { PrebuildComponent, PrebuildOption, PrebuildView } from "./types"

/**
 * Pilihan pelanggan atas barang-barang yang bisa ditukar, dikunci
 * `PrebuildComponent.key` → `productId` yang dipilih.
 *
 * Yang disimpan `productId`, BUKAN indeks pilihan — aturan yang sama dengan
 * `?pick=` di URL (docs/11-pc-prebuild.md §5). Indeks berkhianat diam-diam
 * begitu staff mengurutkan ulang pilihan di panel admin.
 *
 * Kunci yang tidak ada di `selection`, atau yang menunjuk produk yang bukan
 * salah satu pilihan barang itu, JATUH KE BAWAAN — bukan dipaksakan masuk.
 */
export type PrebuildSelection = Record<string, number>

/** Bawaan = pilihan pertama. `null` hanya kalau seluruh pilihannya hilang. */
export function chosenOption(
  component: PrebuildComponent,
  selection: PrebuildSelection
): PrebuildOption | null {
  const diminta = selection[component.key]
  const cocok = component.options.find((o) => o.productId === diminta)
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

/** Id yang memegang harga: variannya kalau ada, kalau tidak produknya sendiri. */
function idBerlaku(option: PrebuildOption): number {
  return option.variationId ?? option.productId
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
  const pilihan = chosenComponents(view, selection).map(({ option }) => idBerlaku(option))
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
 * Bentuknya `stepId:productId`, bukan indeks — lihat catatan panjang di
 * `/build-pc` page.tsx.
 */
export function builderUrl(view: PrebuildView, selection: PrebuildSelection): string {
  const pick = chosenComponents(view, selection)
    .filter(({ component }) => component.branching)
    .map(({ component, option }) => `${component.stepId}:${option.productId}`)
    .join(",")

  const dasar = `/build-pc?preset=${encodeURIComponent(view.id)}`
  return pick ? `${dasar}&pick=${encodeURIComponent(pick)}` : dasar
}
