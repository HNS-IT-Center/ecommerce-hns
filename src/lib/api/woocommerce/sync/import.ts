import { ProductSource } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { decodeHtmlEntities } from "@/lib/utils/html"
import type { ProductInput, ProductVariationInput } from "@/types/woocommerce"
import { createProduct } from "../products"
import { getLocalCatalogSnapshot } from "./local"
import { fetchRemoteProductsByIds, fetchRemoteVariations } from "./remote"
import type { ImportResult, RemoteProduct, RemoteVariation } from "./types"

/**
 * Mengimpor produk yang ada di WooCommerce tapi belum ada di katalog kita.
 *
 * Memakai ulang `createProduct()` — jalur yang sama dengan form produk di panel
 * admin — bukan menulis pembuatan produk versi kedua. Fungsi itu sudah menangani
 * kategori (termasuk menandai yang terdalam sebagai kategori utama), gambar,
 * upsert atribut ke master data, upsert brand, dan varian. Menuliskannya ulang
 * di sini berarti dua jalur yang harus dijaga tetap sama selamanya, dan
 * pengalaman project ini dengan dua penulis `product_logs` sudah menunjukkan
 * bagaimana akhirnya.
 *
 * Bedanya hanya dua, dan keduanya lewat `CreateProductOptions`: nomornya
 * memakai id asli WooCommerce, dan barisnya ditandai `WOO`.
 */

/** Katalog WooCommerce ±3.300 produk; sekali import tidak wajar melewati ini. */
const MAX_IDS = 1000

/**
 * Berapa produk diimpor bersamaan.
 *
 * Setiap produk berarti satu transaksi database, dan produk variable menambah
 * satu permintaan HTTP untuk variannya. Tiga sekaligus sudah memangkas waktu
 * tunggu tanpa menahan banyak koneksi MariaDB — batas Hostinger 500 koneksi per
 * jam, dan skrip yang rakus pernah menghabiskannya sendirian.
 */
const CONCURRENCY = 3

/** WooCommerce punya tipe yang tidak didukung form produk kita. */
const SUPPORTED_TYPES = new Set(["simple", "variable"])

function mapStatus(remoteStatus: string): "publish" | "draft" | "private" {
  if (remoteStatus === "publish") return "publish"
  if (remoteStatus === "private") return "private"
  // `pending`, `future`, dan apa pun yang belum kita kenal jatuh ke draft —
  // kegagalan yang aman: produk tidak tayang sampai ada yang memutuskan.
  return "draft"
}

function mapStockStatus(value: string): "instock" | "outofstock" | "onbackorder" {
  if (value === "outofstock") return "outofstock"
  if (value === "onbackorder") return "onbackorder"
  return "instock"
}

function mapVariations(variations: RemoteVariation[]): ProductVariationInput[] {
  return variations.map((variation) => {
    const attributes: Record<string, string> = {}
    for (const attribute of variation.attributes) {
      const name = decodeHtmlEntities(attribute.name).trim()
      if (name) attributes[name] = decodeHtmlEntities(attribute.option).trim()
    }
    return {
      // Id WooCommerce ikut dikirim supaya varian tersimpan dengan nomor
      // aslinya, bukan nomor pita lokal — lihat `VariationOrigin`.
      id: variation.id,
      attributes,
      sku: variation.sku || undefined,
      regular_price: variation.regular_price || undefined,
      sale_price: variation.sale_price || undefined,
      stock_status: mapStockStatus(variation.stock_status),
      stock_quantity: variation.stock_quantity,
      image_url: variation.image?.src ?? null,
    }
  })
}

/**
 * Menyusun masukan `createProduct` dari satu produk WooCommerce.
 *
 * `categoryId` boleh `null` — artinya tidak ada kategori kita yang cocok, dan
 * produknya masuk sebagai draft.
 */
export function buildProductInput(
  remote: RemoteProduct,
  categoryId: number | null,
  variations: RemoteVariation[],
): ProductInput {
  const isVariable = remote.type === "variable"

  // URL gambar disimpan APA ADANYA dari WooCommerce (host `hnsitcenter.id`),
  // tidak ditulis ulang ke `media.hnsitcenter.com`. Berkas-berkas baru memang
  // tidak ada di CDN itu — jalur yang ditulis ulang menjawab 404 — dan host
  // aslinya sudah diizinkan di `next.config.ts`. Pemindahan gambar ke R2
  // adalah pekerjaan terpisah.
  const images = remote.images.map((image) => ({ url: image.src }))

  // Atribut pembeda varian tidak ikut sebagai atribut biasa: `createProduct`
  // menuliskannya sendiri dari daftar varian, dan memasukkannya dua kali
  // membuat daftar pilihan di halaman produk tertimpa.
  const plainAttributes = remote.attributes
    .filter((attribute) => !attribute.variation)
    .map((attribute) => ({
      name: decodeHtmlEntities(attribute.name).trim(),
      options: attribute.options.map((option) => decodeHtmlEntities(option).trim()).filter(Boolean),
      visible: attribute.visible,
    }))
    .filter((attribute) => attribute.name !== "" && attribute.options.length > 0)

  const variationAttributes = remote.attributes
    .filter((attribute) => attribute.variation)
    .map((attribute) => decodeHtmlEntities(attribute.name).trim())
    .filter(Boolean)

  return {
    name: decodeHtmlEntities(remote.name),
    type: isVariable ? "variable" : "simple",
    // Tanpa kategori yang cocok, produk turun jadi draft apa pun statusnya di
    // WooCommerce. Produk tanpa kategori tidak punya rumah di navigasi maupun
    // breadcrumb, dan katalog ini sudah menanggung ribuan produk seperti itu.
    status: categoryId === null ? "draft" : mapStatus(remote.status),
    description: remote.description || undefined,
    short_description: remote.short_description || undefined,
    regular_price: remote.regular_price || undefined,
    sale_price: remote.sale_price || undefined,
    date_on_sale_to_gmt: remote.date_on_sale_to_gmt ?? undefined,
    stock_status: mapStockStatus(remote.stock_status),
    stock_quantity: remote.stock_quantity,
    categories: categoryId === null ? [] : [{ id: categoryId }],
    attributes: plainAttributes,
    images,
    brand: remote.brands?.[0]?.name ? decodeHtmlEntities(remote.brands[0].name) : null,
    ...(isVariable
      ? { variation_attributes: variationAttributes, variations: mapVariations(variations) }
      : {}),
  }
}

export async function importNewProducts(
  requestedIds: number[],
  userName: string,
): Promise<ImportResult> {
  const ids = [...new Set(requestedIds)].filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) {
    return { imported: 0, draftedWithoutCategory: 0, skipped: [], failed: [] }
  }
  if (ids.length > MAX_IDS) {
    throw new Error(`Terlalu banyak produk sekaligus (${ids.length}). Batasnya ${MAX_IDS}.`)
  }

  const prisma = getPrisma()
  const [remoteProducts, snapshot] = await Promise.all([
    fetchRemoteProductsByIds(ids),
    getLocalCatalogSnapshot(),
  ])
  const remoteById = new Map(remoteProducts.map((product) => [product.id, product]))

  const skipped: ImportResult["skipped"] = []
  const failed: ImportResult["failed"] = []
  const antrian: Array<{ remote: RemoteProduct; categoryId: number | null }> = []

  for (const wooId of ids) {
    const remote = remoteById.get(wooId)

    // Sisi KITA diperiksa lebih dulu — urutan yang sama seperti di `apply.ts`,
    // dan alasannya sama: produk buatan panel umumnya tidak ada di WooCommerce,
    // jadi memeriksa sisi WooCommerce duluan akan menolaknya dengan keterangan
    // "terhapus di sana" yang menyesatkan.
    //
    // Nomor yang sudah dipakai tidak boleh dipaksakan: ia akan menabrak
    // `@unique` pada `woo_id`, dan kalau barisnya milik produk buatan panel,
    // mengimpornya berarti menghapus pekerjaan staff.
    if (snapshot.byWooId.has(wooId)) {
      const local = snapshot.byWooId.get(wooId)
      skipped.push({
        wooId,
        reason:
          local?.source === "LOCAL"
            ? "Nomornya dipakai produk buatan panel admin."
            : "Sudah ada di katalog kita.",
      })
      continue
    }
    if (!remote) {
      skipped.push({ wooId, reason: "Tidak ada di WooCommerce (mungkin dihapus di sana)." })
      continue
    }
    if (!SUPPORTED_TYPES.has(remote.type)) {
      skipped.push({ wooId, reason: `Tipe "${remote.type}" belum didukung form produk.` })
      continue
    }

    const cocok = remote.categories
      .map((category) => decodeHtmlEntities(category.name).trim().toUpperCase())
      .map((nama) => snapshot.categoryIdByName.get(nama))
      .find((id): id is number => id !== undefined)

    antrian.push({ remote, categoryId: cocok ?? null })
  }

  let imported = 0
  let draftedWithoutCategory = 0

  for (let i = 0; i < antrian.length; i += CONCURRENCY) {
    const batch = antrian.slice(i, i + CONCURRENCY)
    const hasil = await Promise.allSettled(
      batch.map(async ({ remote, categoryId }) => {
        const variations =
          remote.type === "variable" ? await fetchRemoteVariations(remote.id) : []
        const input = buildProductInput(remote, categoryId, variations)

        try {
          await createProduct(input, { wooId: remote.id, source: ProductSource.WOO })
        } catch (error) {
          // `createProduct` membuang cache Next SETELAH transaksinya commit.
          // Kalau langkah terakhir itu yang gagal, produknya sudah benar-benar
          // ada — melaporkannya sebagai gagal akan membuat staff mengimpornya
          // lagi, dan percobaan kedua menabrak `@unique` pada `woo_id` tanpa
          // penjelasan yang masuk akal. Jadi diperiksa dulu, baru diputuskan.
          const sudahAda = await prisma.product.findUnique({
            where: { wooId: remote.id },
            select: { id: true },
          })
          if (!sudahAda) throw error
        }

        await prisma.productLog.create({
          data: {
            userName,
            productId: remote.id,
            productName: input.name,
            action: "SYNC_IMPORT",
            fieldAffected: "all",
            oldValue: null,
            newValue: `Diimpor dari WooCommerce sebagai ${input.status}${
              categoryId === null ? " (tanpa kategori yang cocok)" : ""
            }`,
          },
        })
        return { categoryId }
      }),
    )

    for (const [index, item] of hasil.entries()) {
      if (item.status === "fulfilled") {
        imported++
        if (item.value.categoryId === null) draftedWithoutCategory++
      } else {
        const error: unknown = item.reason
        failed.push({
          wooId: batch[index].remote.id,
          message: error instanceof Error ? error.message : "Gagal mengimpor.",
        })
      }
    }
  }

  return { imported, draftedWithoutCategory, skipped, failed }
}
