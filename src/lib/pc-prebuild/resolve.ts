import "server-only"

import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import { buildVariationLabel, displayVariationName } from "@/lib/utils/variation"
import {
  DEFAULT_STOCK_DISPLAY_MODE,
  displayStockCount,
  type StockDisplayMode,
} from "@/lib/api/stock-display"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import { collectPresetProductIds, type PcPrebuildPreset } from "@/lib/pc-prebuild/config"
import {
  isPerformanceStale,
  isPerformanceVisible,
  type PrebuildPerformance,
} from "@/lib/pc-prebuild/performance"

/**
 * Menggabungkan preset (yang cuma menyimpan id) dengan katalog, supaya halaman
 * admin maupun halaman publik bekerja dari satu perhitungan yang sama.
 *
 * **`product.id` internal, BUKAN `wooId`.** `fetchBuilderProducts` di
 * `features/builder/actions.ts` mengembalikan `id: p.id`, dan itulah yang
 * masuk ke store wizard. Preset harus memakai kunci yang sama, kalau tidak
 * komponennya tidak akan ketemu saat dimuat. Perhatikan bahwa
 * `getProductById()` di `lib/api/woocommerce/products.ts` justru mencari lewat
 * `wooId` — dua kunci berbeda hidup berdampingan di repo ini, dan memakai yang
 * keliru menghasilkan "produk tidak ditemukan" yang membingungkan.
 *
 * ## Varian
 *
 * Barang bervarian menyimpan DUA id: `productId` (induk) dan `variationId`
 * (baris VARIATION). Yang menentukan harga dan stok adalah VARIANNYA, bukan
 * induknya — induk VARIABLE sering berharga nol. Karena baris varian juga
 * sebuah `Product`, ia diambil lewat pencarian id yang sama; tidak ada jalur
 * kedua yang harus dijaga.
 */
export type PrebuildProduct = {
  id: number
  name: string
  slug: string
  /** Harga katalog yang berlaku. Tidak pernah disimpan di preset — lihat lib/pc-prebuild/config.ts. */
  price: number
  stock: number
  /** Foto pertama produk; varian tanpa foto memakai foto induknya. */
  image: string | null
  /** Nama induk, kalau baris ini sebuah varian. */
  parentName: string | null
  /** Nilai atribut varian, mis. "1TB · Hitam". Kosong untuk produk biasa. */
  variationLabel: string | null
}

/** Nama yang layak dibaca manusia: induk + varian kalau ada. */
export function namaTampil(product: PrebuildProduct): string {
  return displayVariationName(product)
}

export type ResolvedPrebuildAlternative = {
  productId: number
  variationId?: number
  quantity: number
  /** Label tombol: label yang ditulis staff, atau nama produknya. */
  label: string
  /** `null` = produknya (atau variannya) sudah tidak ada di katalog. */
  product: PrebuildProduct | null
}

export type ResolvedPrebuildItem = ResolvedPrebuildAlternative & {
  stepId: string
  /** Nama step saat ini. Kosong kalau step-nya sudah dihapus dari PC Builder. */
  stepName: string
  /**
   * Pilihan tukar untuk barang ini. Lebih dari nol = `branching` bernilai true.
   *
   * Fitur pemilihan di sisi pelanggan belum dirancang ulang; bidang ini sudah
   * terisi supaya panel admin bisa menampilkannya dan supaya total termurah
   * bisa dihitung.
   */
  alternatives: ResolvedPrebuildAlternative[]
  branching: boolean
  /**
   * Barang yang BENAR-BENAR dipakai untuk menghitung total.
   *
   * Biasanya barang itu sendiri. Kalau produknya sudah dihapus dari katalog, ia
   * jatuh ke pilihan tukar pertama yang masih ada — slot yang bawaannya hilang
   * tidak ditampilkan sebagai slot rusak, ia cuma memakai pilihan lain.
   *
   * `null` = tidak ada satu pun yang tersisa.
   *
   * STOK KOSONG TIDAK MEMINDAHKAN BAWAAN. Barang pertama tetap bawaan, cuma
   * ditandai. Bawaan yang berpindah sendiri karena stok membuat staff melihat
   * paket yang berbeda dari yang ia susun.
   */
  effective: PrebuildProduct | null
}

export type ResolvedPrebuildSlot = {
  stepId: string
  stepName: string
  items: ResolvedPrebuildItem[]
}

export type ResolvedPrebuildPreset = {
  id: string
  name: string
  summary: string
  /** Foto rakitan jadi. Yang pertama = foto utama. */
  images: string[]
  slots: ResolvedPrebuildSlot[]
  /** Seluruh barang dari semua slot, sudah rata — bentuk yang dipakai daftar komponen. */
  items: ResolvedPrebuildItem[]
  /** Menjumlahkan seluruh barang yang produknya masih ada. */
  total: number
  /**
   * Kombinasi TERMURAH dari pilihan yang tersedia — dipakai label "mulai dari".
   * Sama dengan `total` kalau paketnya tidak punya barang bercabang.
   */
  minTotal: number
  /** Barang yang SELURUH pilihannya hilang dari katalog. */
  missingCount: number
  /** Barang yang produknya ada tapi stoknya kosong. */
  outOfStockCount: number
  /** Slot yang step-nya sudah tidak ada di konfigurasi PC Builder. */
  orphanStepCount: number
  /** Barang yang punya pilihan tukar. */
  branchingCount: number
  /**
   * Analisis performa APA ADANYA — termasuk yang masih draf dan yang sudah
   * basi. Ini yang dipakai panel admin, karena di sanalah draf disunting dan
   * status basi harus terlihat.
   */
  performance: PrebuildPerformance | null
  /** Komponen berubah sejak analisis dibuat. Perlu dihitung ulang. */
  performanceStale: boolean
  /**
   * Analisis yang BOLEH dilihat pelanggan — sudah ditayangkan dan belum basi.
   *
   * Disaring di sini, bukan di tiap halaman, dan itu disengaja: kalau aturannya
   * diulang di setiap pemakai, satu halaman yang lupa memeriksanya sudah cukup
   * untuk memperlihatkan draf atau analisis basi ke pelanggan.
   */
  performancePublic: PrebuildPerformance | null
}

/**
 * Harga dan stok mengikuti aturan yang SAMA PERSIS dengan
 * `fetchBuilderProducts`, supaya angka di kartu paket tidak pernah berbeda dari
 * angka yang muncul begitu rakitannya dimuat ke wizard:
 *
 *   price = salePrice > 0 ? salePrice : regularPrice
 *   stock = stockStatus === "OUTOFSTOCK" ? 0 : (stockQty ?? 10)
 *
 * `salePrice` adalah satu-satunya potongan yang sah menurut CLAUDE.md §2.7, dan
 * ia dibaca apa adanya di sini — tidak ada perkalian, tidak ada persentase.
 */
export async function getPrebuildProducts(
  ids: number[],
  stockDisplayMode: StockDisplayMode = DEFAULT_STOCK_DISPLAY_MODE
): Promise<Map<number, PrebuildProduct>> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0)
  if (unik.length === 0) return new Map()

  const kunci = unik
    .slice()
    .sort((a, b) => a - b)
    .join(",")

  const fetcher = unstable_cache(
    async () => {
      const rows = await getPrisma().product.findMany({
        where: { id: { in: unik } },
        select: {
          id: true,
          name: true,
          slug: true,
          regularPrice: true,
          salePrice: true,
          stockStatus: true,
          stockQty: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          // Baris VARIATION menumpang induknya untuk nama dan — kalau ia tidak
          // punya foto sendiri — untuk fotonya juga.
          parent: {
            select: {
              name: true,
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
            },
          },
          attributes: { select: { value: { select: { value: true } } } },
        },
      })

      return rows.map((p) => {
        const sale = p.salePrice ? Number(p.salePrice) : 0
        const regular = p.regularPrice ? Number(p.regularPrice) : 0
        const labelAtribut = buildVariationLabel(p.attributes.map((a) => a.value.value))

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: sale > 0 ? sale : regular,
          stock: p.stockStatus === "OUTOFSTOCK" ? 0 : (p.stockQty ?? 10),
          image: p.images[0]?.url ?? p.parent?.images[0]?.url ?? null,
          parentName: p.parent?.name ?? null,
          // Label varian hanya berarti kalau barisnya memang punya induk.
          // Produk SIMPLE juga punya atribut, dan menampilkannya sebagai
          // "varian" akan membuat setiap komponen tampak bervarian.
          variationLabel: p.parent ? labelAtribut : null,
        }
      })
    },
    [`pc-prebuild-products-${kunci}`],
    { revalidate: 300, tags: ["pc-prebuild-products"] }
  )

  // Sakelar tampilan stok diterapkan DI LUAR `unstable_cache`. Kalau modenya
  // dibaca di dalam fetcher, nilainya ikut terkunci ke entri cache dan
  // perubahan di panel admin baru terasa setelah 5 menit — bukan seketika.
  return new Map(
    (await fetcher()).map((p) => [
      p.id,
      { ...p, stock: displayStockCount(p.stock, stockDisplayMode) },
    ])
  )
}

/** Baris yang menentukan harga: variannya kalau ada, kalau tidak produknya sendiri. */
function produkBerlaku(
  katalog: Map<number, PrebuildProduct>,
  ref: { productId: number; variationId?: number }
): PrebuildProduct | null {
  if (ref.variationId) return katalog.get(ref.variationId) ?? null
  return katalog.get(ref.productId) ?? null
}

function hargaBaris(product: PrebuildProduct | null, quantity: number): number {
  return product ? product.price * quantity : 0
}

/**
 * Preset mentah → preset siap tampil.
 *
 * Barang yang produknya hilang, atau yang step-nya sudah dihapus, TIDAK dibuang
 * — hanya ditandai. Menyembunyikannya diam-diam membuat staff mengira paketnya
 * masih utuh, dan pelanggan melihat total yang tidak menjelaskan kenapa lebih
 * murah.
 */
export async function resolvePrebuildPresets(
  presets: PcPrebuildPreset[],
  steps: PcBuilderStepConfig[],
  /**
   * Bawaannya `actual` supaya panel admin (`/admin/pc-prebuild`) tetap melihat
   * stok yang sebenarnya; halaman pelanggan yang meneruskan mode aslinya.
   */
  stockDisplayMode: StockDisplayMode = DEFAULT_STOCK_DISPLAY_MODE
): Promise<ResolvedPrebuildPreset[]> {
  // Termasuk id varian — lihat `collectPresetProductIds`.
  const katalog = await getPrebuildProducts(
    presets.flatMap(collectPresetProductIds),
    stockDisplayMode
  )
  const namaStep = new Map(steps.map((step) => [step.id, step.name]))

  return presets.map((preset) => {
    const slots: ResolvedPrebuildSlot[] = preset.slots.map((slot) => {
      const stepName = namaStep.get(slot.stepId) ?? ""

      const items: ResolvedPrebuildItem[] = slot.items.map((item) => {
        const product = produkBerlaku(katalog, item)

        const alternatives: ResolvedPrebuildAlternative[] = item.alternatives.map((alt) => {
          const altProduct = produkBerlaku(katalog, alt)
          return {
            productId: alt.productId,
            ...(alt.variationId ? { variationId: alt.variationId } : {}),
            quantity: alt.quantity,
            label: alt.label || (altProduct ? namaTampil(altProduct) : `Produk #${alt.productId}`),
            product: altProduct,
          }
        })

        return {
          stepId: slot.stepId,
          stepName,
          productId: item.productId,
          ...(item.variationId ? { variationId: item.variationId } : {}),
          quantity: item.quantity,
          label: item.label || (product ? namaTampil(product) : `Produk #${item.productId}`),
          product,
          alternatives,
          branching: alternatives.length > 0,
          effective: product ?? alternatives.find((a) => a.product !== null)?.product ?? null,
        }
      })

      return { stepId: slot.stepId, stepName, items }
    })

    const semuaItem = slots.flatMap((slot) => slot.items)

    return {
      id: preset.id,
      name: preset.name,
      summary: preset.summary,
      images: preset.images,
      slots,
      items: semuaItem,
      total: semuaItem.reduce((jumlah, item) => jumlah + hargaBaris(item.effective, item.quantity), 0),
      minTotal: semuaItem.reduce((jumlah, item) => {
        // Kandidat termurah = barang itu sendiri plus seluruh pilihan tukarnya,
        // yang produknya masih ada.
        const kandidat = [
          { product: item.product, quantity: item.quantity },
          ...item.alternatives,
        ].filter((k) => k.product !== null)

        if (kandidat.length === 0) return jumlah
        return jumlah + Math.min(...kandidat.map((k) => hargaBaris(k.product, k.quantity)))
      }, 0),
      missingCount: semuaItem.filter((item) => item.effective === null).length,
      outOfStockCount: semuaItem.filter(
        (item) => item.effective !== null && item.effective.stock <= 0
      ).length,
      orphanStepCount: slots.filter((slot) => slot.stepName === "").length,
      branchingCount: semuaItem.filter((item) => item.branching).length,
      // Sidik jarinya dihitung dari `preset.slots` (bentuk tersimpan), BUKAN
      // dari `slots` hasil resolve. Produk yang hilang dari katalog mengubah
      // hasil resolve tapi tidak mengubah apa yang staff susun — dan analisis
      // tidak seharusnya dinyatakan basi gara-gara katalog, sebab tidak ada
      // yang bisa dikerjakan staff untuk itu selain mengganti komponennya
      // (yang toh mengubah sidik jari juga).
      performance: preset.performance ?? null,
      performanceStale: isPerformanceStale(preset.performance, preset.slots),
      performancePublic: isPerformanceVisible(preset.performance, preset.slots)
        ? preset.performance
        : null,
    }
  })
}
