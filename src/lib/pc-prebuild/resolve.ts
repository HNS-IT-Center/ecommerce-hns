import "server-only"

import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildPreset } from "@/lib/pc-prebuild/config"
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
 */
export type PrebuildProduct = {
  id: number
  name: string
  slug: string
  /** Harga katalog yang berlaku. Tidak pernah disimpan di preset — lihat lib/pc-prebuild/config.ts. */
  price: number
  stock: number
  /** Foto pertama produk, kalau ada. Host-nya sudah terdaftar di next.config.ts. */
  image: string | null
}

export type ResolvedPrebuildOption = {
  productId: number
  quantity: number
  /** Label tombol: label yang ditulis staff, atau nama produknya. */
  label: string
  /** `null` = produknya sudah tidak ada di katalog. */
  product: PrebuildProduct | null
}

export type ResolvedPrebuildSlot = {
  stepId: string
  /** Nama step saat ini. Kosong kalau step-nya sudah dihapus dari PC Builder. */
  stepName: string
  options: ResolvedPrebuildOption[]
  /**
   * Indeks pilihan bawaan yang EFEKTIF, atau -1 kalau tidak ada satu pun
   * produknya tersisa di katalog.
   *
   * Bawaan adalah pilihan pertama — kecuali produknya sudah dihapus, maka
   * jatuh ke pilihan tersedia berikutnya. Slot yang bawaannya hilang tidak
   * ditampilkan sebagai slot rusak; ia cuma memakai pilihan lain.
   *
   * STOK KOSONG TIDAK MEMINDAHKAN BAWAAN. Pilihan pertama tetap bawaan, cuma
   * ditandai, dan tetap bisa dipilih — pelanggan bisa menukarnya di wizard.
   * Bawaan yang berpindah sendiri karena stok membuat staff melihat paket yang
   * berbeda dari yang ia susun.
   */
  defaultIndex: number
  /** Lebih dari satu pilihan = pelanggan boleh memilih. */
  branching: boolean
}

/** Proyeksi satu slot pada pilihan bawaannya — bentuk yang dipakai halaman hari ini. */
export type ResolvedPrebuildItem = {
  stepId: string
  stepName: string
  quantity: number
  product: PrebuildProduct | null
}

export type ResolvedPrebuildPreset = {
  id: string
  name: string
  summary: string
  /** Foto rakitan jadi. Yang pertama = foto utama. Kosong = kartu tanpa foto rakitan. */
  images: string[]
  /** Seluruh pilihan tiap slot. Dipakai saat pemilihan varian dikerjakan. */
  slots: ResolvedPrebuildSlot[]
  /** Slot pada pilihan bawaannya — satu entri per slot. */
  items: ResolvedPrebuildItem[]
  /** Menjumlahkan pilihan bawaan tiap slot yang produknya masih ada. */
  total: number
  /**
   * Kombinasi TERMURAH dari pilihan yang tersedia — dipakai label "mulai dari".
   * Sama dengan `total` kalau paketnya tidak punya slot bercabang.
   */
  minTotal: number
  /** Slot yang SELURUH pilihannya hilang dari katalog. */
  missingCount: number
  /** Slot yang bawaannya ada tapi stoknya kosong. */
  outOfStockCount: number
  /** Slot yang step-nya sudah tidak ada di konfigurasi PC Builder. */
  orphanStepCount: number
  /** Slot yang punya lebih dari satu pilihan. */
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
   * untuk memperlihatkan draf atau analisis basi ke pelanggan. Halaman publik
   * cukup membaca bidang ini dan tidak perlu tahu aturannya.
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
export async function getPrebuildProducts(ids: number[]): Promise<Map<number, PrebuildProduct>> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id))
  if (unik.length === 0) return new Map()

  const kunci = unik.slice().sort((a, b) => a - b).join(",")

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
          images: {
            orderBy: { position: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      })

      return rows.map((p) => {
        const sale = p.salePrice ? Number(p.salePrice) : 0
        const regular = p.regularPrice ? Number(p.regularPrice) : 0
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: sale > 0 ? sale : regular,
          stock: p.stockStatus === "OUTOFSTOCK" ? 0 : (p.stockQty ?? 10),
          image: p.images[0]?.url ?? null,
        }
      })
    },
    [`pc-prebuild-products-${kunci}`],
    { revalidate: 300, tags: ["pc-prebuild-products"] }
  )

  return new Map((await fetcher()).map((p) => [p.id, p]))
}

/**
 * Preset mentah → preset siap tampil.
 *
 * Slot yang seluruh pilihannya hilang, atau yang step-nya sudah dihapus, TIDAK
 * dibuang — hanya ditandai. Menyembunyikannya diam-diam membuat staff mengira
 * paketnya masih utuh, dan pelanggan melihat total yang tidak menjelaskan
 * kenapa lebih murah.
 */
export async function resolvePrebuildPresets(
  presets: PcPrebuildPreset[],
  steps: PcBuilderStepConfig[]
): Promise<ResolvedPrebuildPreset[]> {
  const semuaId = presets.flatMap((preset) =>
    preset.slots.flatMap((slot) => slot.options.map((option) => option.productId))
  )
  const katalog = await getPrebuildProducts(semuaId)
  const namaStep = new Map(steps.map((step) => [step.id, step.name]))

  return presets.map((preset) => {
    const slots: ResolvedPrebuildSlot[] = preset.slots.map((slot) => {
      const options: ResolvedPrebuildOption[] = slot.options.map((option) => {
        const product = katalog.get(option.productId) ?? null
        return {
          productId: option.productId,
          quantity: option.quantity,
          label: option.label || product?.name || `Produk #${option.productId}`,
          product,
        }
      })

      return {
        stepId: slot.stepId,
        stepName: namaStep.get(slot.stepId) ?? "",
        options,
        defaultIndex: options.findIndex((option) => option.product !== null),
        branching: options.length > 1,
      }
    })

    const items: ResolvedPrebuildItem[] = slots.map((slot) => {
      const terpakai = slot.defaultIndex >= 0 ? slot.options[slot.defaultIndex] : slot.options[0]
      return {
        stepId: slot.stepId,
        stepName: slot.stepName,
        quantity: terpakai?.quantity ?? 1,
        product: slot.defaultIndex >= 0 ? terpakai.product : null,
      }
    })

    return {
      id: preset.id,
      name: preset.name,
      summary: preset.summary,
      images: preset.images,
      slots,
      items,
      total: items.reduce(
        (jumlah, item) => jumlah + (item.product ? item.product.price * item.quantity : 0),
        0
      ),
      minTotal: slots.reduce((jumlah, slot) => {
        const tersedia = slot.options.filter((option) => option.product !== null)
        if (tersedia.length === 0) return jumlah
        return jumlah + Math.min(...tersedia.map((o) => o.product!.price * o.quantity))
      }, 0),
      missingCount: slots.filter((slot) => slot.defaultIndex < 0).length,
      outOfStockCount: items.filter((item) => item.product !== null && item.product.stock <= 0)
        .length,
      orphanStepCount: slots.filter((slot) => slot.stepName === "").length,
      branchingCount: slots.filter((slot) => slot.branching).length,
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
