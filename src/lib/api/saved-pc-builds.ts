import "server-only"

import { getPrisma } from "@/lib/prisma/client"
import { displayStockCount, getStockDisplayMode } from "@/lib/api/stock-display"
import { buildVariationLabel } from "@/lib/utils/variation"

/** Batas jumlah rakitan yang boleh disimpan satu akun. */
export const MAX_SAVED_BUILDS_PER_CUSTOMER = 20

/**
 * Referensi komponen DI DALAM `SavedPcBuild.items`.
 *
 * `price` di sini adalah HARGA ACUAN — harga katalog pada saat rakitan
 * disimpan (atau saat terakhir "diperbarui", lihat `refreshBuildPrices`).
 * Ini BUKAN pelanggaran CLAUDE.md §2.7: §2.7 melarang harga yang DIKARANG
 * atau DIHITUNG di klien untuk keperluan checkout/keranjang. Angka ini
 * sebaliknya SELALU diisi di server dari `Product` katalog pada saat
 * disimpan, dan dipakai murni sebagai pembanding historis ("naik/turun
 * sejak disimpan") — bukan harga yang bisa dibayar. Harga yang dibayar tetap
 * `currentPrice` (dihitung ulang di `resolveBuild`), sama seperti
 * `PcBuildQuote`/`/verify/[code]` yang sudah lama memakai pola snapshot yang
 * sama untuk alasan yang sama: pelanggan berhak tahu kalau harga naik
 * setelah ia melihatnya pertama kali, bukan cuma melihat angka yang mendadak
 * berbeda tanpa penjelasan.
 */
export type SavedBuildItemRef = {
  stepId: string
  stepName: string
  productId: number
  quantity: number
  /** Harga satuan katalog saat disimpan/terakhir diperbarui. */
  price: number
}

export type ResolvedBuildItem = {
  stepId: string
  stepName: string
  productId: number
  quantity: number
  /** Harga satuan saat rakitan disimpan/terakhir diperbarui — lihat `SavedBuildItemRef.price`. */
  savedPrice: number
  /**
   * `null` kalau produk sudah dihapus atau di-draft-kan staff sejak rakitan
   * ini disimpan. Baris tetap ditampilkan (dengan nama & harga acuan
   * terakhir yang diketahui), hanya ditandai tidak tersedia dan dikeluarkan
   * dari subtotal — bukan disembunyikan, supaya rakitan tidak tampak
   * berkurang komponen tanpa penjelasan.
   */
  product: {
    id: number
    name: string
    slug: string
    /** Harga satuan katalog SAAT INI. */
    currentPrice: number
    image: string | null
    /**
     * Opsi varian yang dipilih, mis. "1TB · Hitam". `null` untuk komponen
     * biasa. Dilaporkan terpisah dari `name` supaya halaman bisa
     * menampilkannya sebagai barisnya sendiri — dua kapasitas dari SSD yang
     * sama bisa tersimpan dengan nama yang persis sama.
     */
    variationLabel: string | null
  } | null
  /** `currentPrice - savedPrice` per satuan. Positif = naik. `null` kalau produk tidak tersedia. */
  priceDelta: number | null
}

export type ResolvedSavedBuild = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  items: ResolvedBuildItem[]
  /** Jumlah komponen (baris), termasuk yang tidak tersedia. */
  itemCount: number
  /** Total harga SAAT INI, HANYA dari komponen yang masih tersedia. */
  subtotal: number
  /** Total harga acuan (saat disimpan/terakhir diperbarui), komponen yang sama dengan `subtotal`. */
  savedSubtotal: number
  /** Ada minimal satu komponen yang sudah tidak tersedia. */
  hasUnavailableItems: boolean
  /** Ada minimal satu komponen tersedia yang harganya berubah sejak disimpan. */
  hasPriceChanges: boolean
}

function isItemRef(value: unknown): value is SavedBuildItemRef {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.stepId === "string" &&
    typeof item.stepName === "string" &&
    typeof item.productId === "number" &&
    typeof item.quantity === "number" &&
    item.quantity > 0 &&
    typeof item.price === "number"
  )
}

function currentPriceOf(product: { regularPrice: unknown; salePrice: unknown }): number {
  const regular = product.regularPrice ? Number(product.regularPrice) : 0
  const sale = product.salePrice ? Number(product.salePrice) : 0
  return sale > 0 ? sale : regular
}

/**
 * Isi `items` satu rakitan dengan data produk TERKINI dari katalog, dan
 * bandingkan dengan harga acuan yang tersimpan per komponen.
 */
async function resolveBuild(id: string, name: string, itemsJson: unknown, createdAt: Date, updatedAt: Date): Promise<ResolvedSavedBuild> {
  const refs = Array.isArray(itemsJson) ? itemsJson.filter(isItemRef) : []

  const productIds = [...new Set(refs.map((r) => r.productId))]
  const products = productIds.length
    ? await getPrisma().product.findMany({
        where: { id: { in: productIds }, status: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          slug: true,
          regularPrice: true,
          salePrice: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          // Terisi hanya kalau barisnya sebuah varian: nama & foto ditumpangkan
          // dari induk, pembedanya diambil dari nilai atributnya sendiri.
          parent: {
            select: {
              name: true,
              slug: true,
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
            },
          },
          attributes: { select: { value: { select: { value: true } } } },
        },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  let subtotal = 0
  let savedSubtotal = 0
  let hasUnavailableItems = false
  let hasPriceChanges = false

  const items: ResolvedBuildItem[] = refs.map((ref) => {
    const product = byId.get(ref.productId)
    if (!product) {
      hasUnavailableItems = true
      return { ...ref, savedPrice: ref.price, product: null, priceDelta: null }
    }

    const currentPrice = currentPriceOf(product)
    const priceDelta = currentPrice - ref.price
    if (priceDelta !== 0) hasPriceChanges = true

    subtotal += currentPrice * ref.quantity
    savedSubtotal += ref.price * ref.quantity

    return {
      ...ref,
      savedPrice: ref.price,
      product: {
        id: product.id,
        name: product.parent?.name ?? product.name,
        slug: product.parent?.slug ?? product.slug,
        currentPrice,
        image: product.images[0]?.url ?? product.parent?.images[0]?.url ?? null,
        variationLabel: product.parent
          ? buildVariationLabel(product.attributes.map((a) => a.value.value))
          : null,
      },
      priceDelta,
    }
  })

  return {
    id,
    name,
    createdAt,
    updatedAt,
    items,
    itemCount: items.length,
    subtotal,
    savedSubtotal,
    hasUnavailableItems,
    hasPriceChanges,
  }
}

/** Rakitan tersimpan milik satu akun, terbaru dulu. */
export async function listSavedBuilds(customerId: string): Promise<ResolvedSavedBuild[]> {
  const rows = await getPrisma().savedPcBuild.findMany({
    where: { customerId },
    orderBy: { updatedAt: "desc" },
  })

  return Promise.all(rows.map((row) => resolveBuild(row.id, row.name, row.items, row.createdAt, row.updatedAt)))
}

/** Satu rakitan, HANYA kalau milik `customerId` — mencegah IDOR lewat menebak id. */
export async function getSavedBuild(id: string, customerId: string): Promise<ResolvedSavedBuild | null> {
  const row = await getPrisma().savedPcBuild.findFirst({
    where: { id, customerId },
  })
  if (!row) return null

  return resolveBuild(row.id, row.name, row.items, row.createdAt, row.updatedAt)
}

export type CreateSavedBuildInput = {
  stepId: string
  stepName: string
  productId: number
  quantity: number
}

export type CreateSavedBuildResult =
  | { ok: true; id: string }
  | { ok: false; error: string }

/**
 * Klien hanya mengirim id komponen, kuantitas, dan label langkah — SAMA
 * seperti `prepareBuildWhatsApp`/`handlePrint`. Harga acuan diisi DI SINI
 * dari katalog, tidak pernah dipercaya dari klien, persis prinsip yang sama
 * dengan checkout: klien tidak berwenang menentukan angka yang tersimpan.
 */
export async function createSavedBuild(
  customerId: string,
  name: string,
  items: CreateSavedBuildInput[]
): Promise<CreateSavedBuildResult> {
  if (items.length === 0) {
    return { ok: false, error: "Rakitan masih kosong, belum ada yang bisa disimpan." }
  }

  const prisma = getPrisma()
  const count = await prisma.savedPcBuild.count({ where: { customerId } })
  if (count >= MAX_SAVED_BUILDS_PER_CUSTOMER) {
    return {
      ok: false,
      error: `Maksimal ${MAX_SAVED_BUILDS_PER_CUSTOMER} rakitan tersimpan. Hapus salah satu dulu untuk menyimpan yang baru.`,
    }
  }

  const productIds = [...new Set(items.map((i) => i.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, regularPrice: true, salePrice: true },
  })
  const priceById = new Map(products.map((p) => [p.id, currentPriceOf(p)]))

  const refs: SavedBuildItemRef[] = items.map((item) => ({
    stepId: item.stepId,
    stepName: item.stepName,
    productId: item.productId,
    quantity: item.quantity,
    price: priceById.get(item.productId) ?? 0,
  }))

  const created = await prisma.savedPcBuild.create({
    data: { customerId, name, items: refs },
    select: { id: true },
  })

  return { ok: true, id: created.id }
}

/** `true` kalau berhasil dihapus, `false` kalau tidak ditemukan/bukan milik akun ini. */
export async function deleteSavedBuild(id: string, customerId: string): Promise<boolean> {
  const result = await getPrisma().savedPcBuild.deleteMany({ where: { id, customerId } })
  return result.count > 0
}

/**
 * Tulis ulang harga acuan tiap komponen ke harga katalog SAAT INI — dipicu
 * tombol "Perbarui Harga Acuan" di halaman detail. `productId`/`quantity`
 * tidak berubah, hanya `price`. Komponen yang sudah tidak tersedia
 * dibiarkan dengan harga acuan lamanya (tidak ada harga baru untuk diisi).
 *
 * Setelah dipanggil, `priceDelta` seluruh komponen yang tersedia kembali ke
 * nol — baseline baru dimulai dari titik ini. Ini disengaja: pembanding
 * "naik/turun" hanya bermakna relatif terhadap kapan pelanggan TERAKHIR
 * melihat dan menyetujui harganya, bukan terhadap tanggal pembuatan baris
 * yang mungkin sudah setahun lalu.
 */
export async function refreshBuildPrices(id: string, customerId: string): Promise<boolean> {
  const prisma = getPrisma()
  const row = await prisma.savedPcBuild.findFirst({ where: { id, customerId } })
  if (!row) return false

  const refs = Array.isArray(row.items) ? row.items.filter(isItemRef) : []
  if (refs.length === 0) return false

  const productIds = [...new Set(refs.map((r) => r.productId))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: "PUBLISHED" },
    select: { id: true, regularPrice: true, salePrice: true },
  })
  const priceById = new Map(products.map((p) => [p.id, currentPriceOf(p)]))

  const refreshed: SavedBuildItemRef[] = refs.map((ref) => ({
    ...ref,
    price: priceById.get(ref.productId) ?? ref.price,
  }))

  await prisma.savedPcBuild.update({
    where: { id },
    data: { items: refreshed },
  })

  return true
}

export type BuilderReadyProduct = {
  id: number
  name: string
  price: number
  regularPrice: number
  salePrice: number
  image?: string
  slug: string
  sold: number
  stock: number
  type: string
  attributes: { attributeId: number; attributeName: string; valueId: number; valueName: string }[]
  /** Sama artinya dengan medan bernama sama di `BuilderProduct` — lihat store/new-builder.ts. */
  parentId?: number
  parentName?: string
  variationLabel?: string
  variations?: {
    id: number
    label: string
    price: number
    regularPrice: number
    salePrice: number
    stock: number
    image?: string
  }[]
}

export type BuilderReadySelections = Record<string, { product: BuilderReadyProduct; quantity: number }[]>

/**
 * Bentuk yang sama seperti `fetchBuilderProducts` di `features/builder/actions.ts`
 * (dipakai untuk mengisi grid pemilihan produk) — dipakai ulang di sini supaya
 * tombol "Lanjutkan di Builder" mengisi `useNewBuilderStore` dengan objek
 * produk yang lengkap, bukan cuma id.
 *
 * Komponen yang sudah tidak tersedia (dihapus/di-draft) DILEWATI, bukan
 * dimuat sebagai baris rusak ke builder — builder tidak punya konsep
 * "komponen tidak tersedia" seperti halaman detail rakitan.
 */
export async function getSavedBuildForBuilder(
  id: string,
  customerId: string
): Promise<BuilderReadySelections | null> {
  const row = await getPrisma().savedPcBuild.findFirst({ where: { id, customerId } })
  if (!row) return null

  const refs = Array.isArray(row.items) ? row.items.filter(isItemRef) : []
  const productIds = [...new Set(refs.map((r) => r.productId))]

  const products = productIds.length
    ? await getPrisma().product.findMany({
        where: { id: { in: productIds }, status: "PUBLISHED" },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          regularPrice: true,
          salePrice: true,
          stockQty: true,
          stockStatus: true,
          viewCount: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
          attributes: {
            select: {
              attribute: { select: { id: true, name: true } },
              value: { select: { id: true, value: true } },
            },
          },
          /**
           * Terisi hanya kalau barisnya sebuah varian. Dari sini datang tiga
           * hal yang tidak dimiliki baris varian itu sendiri: nama yang layak
           * dibaca, ATRIBUT KOMPATIBILITAS (socket, form factor — atribut
           * varian hanyalah pembedanya: kapasitas, warna), dan daftar saudara
           * variannya supaya tombol "Ganti Opsi" di wizard langsung berfungsi
           * tanpa memuat ulang apa pun.
           */
          parent: {
            select: {
              id: true,
              name: true,
              slug: true,
              images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              attributes: {
                select: {
                  attribute: { select: { id: true, name: true } },
                  value: { select: { id: true, value: true } },
                },
              },
              variations: {
                where: { status: "PUBLISHED" },
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  name: true,
                  regularPrice: true,
                  salePrice: true,
                  stockQty: true,
                  stockStatus: true,
                  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                  attributes: { select: { value: { select: { value: true } } } },
                },
              },
            },
          },
        },
      })
    : []
  const byId = new Map(products.map((p) => [p.id, p]))

  // Rakitan tersimpan dibuka kembali di PC Builder, jadi ketersediaannya harus
  // dibaca dengan sakelar yang sama seperti katalog.
  const stockDisplayMode = await getStockDisplayMode()

  const selections: BuilderReadySelections = {}
  for (const ref of refs) {
    const product = byId.get(ref.productId)
    if (!product) continue

    const regularPrice = product.regularPrice ? Number(product.regularPrice) : 0
    const salePrice = product.salePrice ? Number(product.salePrice) : 0
    const price = salePrice > 0 ? salePrice : regularPrice

    const induk = product.parent

    const builderProduct: BuilderReadyProduct = {
      id: product.id,
      // Nama induk untuk baris varian: varian warisan impor WooCommerce sering
      // bernama sama persis dengan induknya, jadi pembedanya HARUS
      // `variationLabel`, bukan `name`.
      name: induk?.name ?? product.name,
      slug: induk?.slug ?? product.slug,
      type: product.type,
      price,
      regularPrice,
      salePrice,
      sold: product.viewCount || 0,
      stock: displayStockCount(
        product.stockStatus === "OUTOFSTOCK" ? 0 : (product.stockQty ?? 10),
        stockDisplayMode
      ),
      image: product.images[0]?.url ?? induk?.images[0]?.url,
      // Atribut kompatibilitas dari INDUK — alasannya ada di select di atas.
      attributes: (induk?.attributes ?? product.attributes).map((a) => ({
        attributeId: a.attribute.id,
        attributeName: a.attribute.name,
        valueId: a.value.id,
        valueName: a.value.value,
      })),
      ...(induk
        ? {
            parentId: induk.id,
            parentName: induk.name,
            variationLabel:
              buildVariationLabel(product.attributes.map((a) => a.value.value)) ?? undefined,
            variations: induk.variations.map((v) => {
              const vRegular = v.regularPrice ? Number(v.regularPrice) : 0
              const vSale = v.salePrice ? Number(v.salePrice) : 0
              return {
                id: v.id,
                label: buildVariationLabel(v.attributes.map((a) => a.value.value)) ?? v.name,
                price: vSale > 0 ? vSale : vRegular,
                regularPrice: vRegular,
                salePrice: vSale,
                stock: displayStockCount(
                  v.stockStatus === "OUTOFSTOCK" ? 0 : (v.stockQty ?? 10),
                  stockDisplayMode
                ),
                image: v.images[0]?.url,
              }
            }),
          }
        : {}),
    }

    if (!selections[ref.stepId]) selections[ref.stepId] = []
    selections[ref.stepId].push({ product: builderProduct, quantity: ref.quantity })
  }

  return selections
}
