import "server-only"

import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"
import type { PcBuilderStepConfig } from "@/lib/pc-builder/config"
import type { PcPrebuildPreset } from "@/lib/pc-prebuild/config"

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
}

export type ResolvedPrebuildItem = {
  stepId: string
  /** Nama step saat ini. Kosong kalau step-nya sudah dihapus dari PC Builder. */
  stepName: string
  quantity: number
  /** `null` = produknya sudah tidak ada di katalog. */
  product: PrebuildProduct | null
}

export type ResolvedPrebuildPreset = {
  id: string
  name: string
  summary: string
  items: ResolvedPrebuildItem[]
  /** Hanya menjumlahkan item yang produknya masih ada. */
  total: number
  /** Item yang produknya hilang dari katalog. */
  missingCount: number
  /** Item yang produknya ada tapi stoknya kosong. */
  outOfStockCount: number
  /** Item yang step-nya sudah tidak ada di konfigurasi PC Builder. */
  orphanStepCount: number
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
 * Item yang produknya hilang atau step-nya sudah dihapus TIDAK dibuang, hanya
 * ditandai. Menyembunyikannya diam-diam membuat staff mengira paketnya masih
 * utuh, dan pelanggan melihat total yang tidak menjelaskan kenapa lebih murah.
 */
export async function resolvePrebuildPresets(
  presets: PcPrebuildPreset[],
  steps: PcBuilderStepConfig[]
): Promise<ResolvedPrebuildPreset[]> {
  const semuaId = presets.flatMap((preset) => preset.items.map((item) => item.productId))
  const katalog = await getPrebuildProducts(semuaId)
  const namaStep = new Map(steps.map((step) => [step.id, step.name]))

  return presets.map((preset) => {
    const items: ResolvedPrebuildItem[] = preset.items.map((item) => ({
      stepId: item.stepId,
      stepName: namaStep.get(item.stepId) ?? "",
      quantity: item.quantity,
      product: katalog.get(item.productId) ?? null,
    }))

    return {
      id: preset.id,
      name: preset.name,
      summary: preset.summary,
      items,
      total: items.reduce(
        (jumlah, item) => jumlah + (item.product ? item.product.price * item.quantity : 0),
        0
      ),
      missingCount: items.filter((item) => item.product === null).length,
      outOfStockCount: items.filter((item) => item.product !== null && item.product.stock <= 0)
        .length,
      orphanStepCount: items.filter((item) => item.stepName === "").length,
    }
  })
}
