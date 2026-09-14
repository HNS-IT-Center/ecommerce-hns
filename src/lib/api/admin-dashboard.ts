import "server-only"

import { ProductType, type Prisma, type ProductStatus } from "@prisma/client"
import { getPrisma } from "@/lib/prisma/client"
import { decodeHtmlEntities } from "@/lib/utils/html"
import { PRICE_ACTIONS } from "@/lib/logs/actions"
import {
  ACTIVE_PRODUCT_STATUSES,
  flagWhere,
  resolveCategoryScope,
  type ProductFlag,
} from "@/lib/api/woocommerce/product-health"

/**
 * Data kartu-kartu di halaman Overview admin.
 *
 * Sengaja TIDAK lewat `unstable_cache`: dashboard adalah tempat staff memeriksa
 * apakah SKU yang baru mereka isi sudah membuat produknya keluar dari daftar.
 * Angka yang tertinggal lima menit terbaca seperti simpanan yang gagal. Yang
 * membukanya hanya segelintir orang, jadi query langsung tidak membebani.
 *
 * Seluruh penghitungan produk memakai `ACTIVE_PRODUCT_STATUSES` (terbit +
 * draft), dan kondisi "bermasalah"-nya diambil dari `product-health.ts` — sama
 * persis dengan yang dipakai daftar `/admin/produk` saat "Lihat semua" ditekan.
 */

/** Jumlah baris per daftar di kartu. Selebihnya lewat tautan "Lihat semua". */
const LIST_LIMIT = 10
const LOG_LIMIT = 20

export type DashboardProductItem = {
  /** Id baris Prisma — kunci render, unik antar-produk maupun antar-varian. */
  id: number
  /**
   * `wooId` untuk tautan `/admin/produk/[id]`. Untuk varian ini id INDUKNYA:
   * varian disunting dari form induk, tidak punya halaman sendiri.
   */
  editId: number
  name: string
  /** Kategori utama — untuk varian, kategori induknya (varian tak berkategori). */
  category: string | null
  status: ProductStatus
  isOutOfStock: boolean
  isZeroQty: boolean
}

export type ProductFlagSummary = {
  simple: { count: number; items: DashboardProductItem[] }
  variation: {
    count: number
    /** Jumlah induk yang terdampak — itulah yang tampil di daftar produk. */
    parentCount: number
    items: DashboardProductItem[]
  }
}

export type ProductTypeTotals = {
  simple: number
  variable: number
  variations: number
}

export type LatestProductItem = DashboardProductItem & {
  type: ProductType
  variationCount: number
  importedAt: Date
}

export type DashboardLogItem = {
  id: number
  userName: string
  productName: string
  action: string
  fieldAffected: string
  oldValue: string | null
  newValue: string | null
  createdAt: Date
}

/**
 * Nilai penyaring kartu log: "price" (bawaan), "all", atau satu nama aksi
 * persis seperti tersimpan di tabel.
 */
export type LogFilter = string

const categorySelect = {
  select: { category: { select: { name: true } } },
  orderBy: { isPrimary: "desc" },
  take: 1,
} satisfies Prisma.Product$categoriesArgs

const itemSelect = {
  id: true,
  wooId: true,
  name: true,
  status: true,
  stockStatus: true,
  stockQty: true,
  categories: categorySelect,
  parent: { select: { wooId: true, categories: categorySelect } },
} satisfies Prisma.ProductSelect

type ItemRow = Prisma.ProductGetPayload<{ select: typeof itemSelect }>

function toItem(row: ItemRow): DashboardProductItem {
  const categoryName =
    row.categories[0]?.category.name ?? row.parent?.categories[0]?.category.name ?? null

  return {
    id: row.id,
    editId: row.parent?.wooId ?? row.wooId,
    name: decodeHtmlEntities(row.name),
    category: categoryName ? decodeHtmlEntities(categoryName) : null,
    status: row.status,
    isOutOfStock: row.stockStatus === "OUTOFSTOCK",
    isZeroQty: row.stockQty !== null && row.stockQty <= 0,
  }
}

/** `null` = semua kategori. */
async function scopeFor(rootCategoryId: number | null): Promise<number[] | null> {
  return rootCategoryId === null ? null : resolveCategoryScope(rootCategoryId)
}

function ownCategoryWhere(scope: number[] | null): Prisma.ProductWhereInput {
  return scope ? { categories: { some: { categoryId: { in: scope } } } } : {}
}

/** Varian tidak punya baris kategori sendiri — cakupannya dibaca dari induk. */
function parentCategoryWhere(scope: number[] | null): Prisma.ProductWhereInput {
  return scope ? { parent: { categories: { some: { categoryId: { in: scope } } } } } : {}
}

function simpleWhere(scope: number[] | null): Prisma.ProductWhereInput {
  return {
    AND: [
      { parentId: null, type: ProductType.SIMPLE, status: { in: ACTIVE_PRODUCT_STATUSES } },
      ownCategoryWhere(scope),
    ],
  }
}

function variableWhere(scope: number[] | null): Prisma.ProductWhereInput {
  return {
    AND: [
      { parentId: null, type: ProductType.VARIABLE, status: { in: ACTIVE_PRODUCT_STATUSES } },
      ownCategoryWhere(scope),
    ],
  }
}

/** Varian aktif yang INDUKNYA juga aktif — varian dari induk private tak dihitung. */
function variationWhere(scope: number[] | null): Prisma.ProductWhereInput {
  return {
    AND: [
      {
        type: ProductType.VARIATION,
        status: { in: ACTIVE_PRODUCT_STATUSES },
        parent: { status: { in: ACTIVE_PRODUCT_STATUSES } },
      },
      parentCategoryWhere(scope),
    ],
  }
}

export async function getProductFlagSummary(
  flag: ProductFlag,
  rootCategoryId: number | null
): Promise<ProductFlagSummary> {
  const scope = await scopeFor(rootCategoryId)
  const prisma = getPrisma()
  const condition = flagWhere(flag)

  const simple: Prisma.ProductWhereInput = { AND: [simpleWhere(scope), condition] }
  const variation: Prisma.ProductWhereInput = { AND: [variationWhere(scope), condition] }
  const affectedParents: Prisma.ProductWhereInput = {
    AND: [
      variableWhere(scope),
      {
        variations: {
          some: { AND: [{ status: { in: ACTIVE_PRODUCT_STATUSES } }, condition] },
        },
      },
    ],
  }

  // SKU kosong diurutkan dari produk terbaru — yang baru ditambahkan paling
  // mungkin masih bisa dilacak SKU-nya. Stok kosong diurutkan dari perubahan
  // terakhir, supaya barang yang baru saja habis ada di atas.
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    flag === "missing-sku"
      ? [{ importedAt: "desc" }, { id: "desc" }]
      : [{ updatedAt: "desc" }, { id: "desc" }]

  const [simpleCount, simpleRows, variationCount, variationRows, parentCount] = await Promise.all([
    prisma.product.count({ where: simple }),
    prisma.product.findMany({ where: simple, select: itemSelect, orderBy, take: LIST_LIMIT }),
    prisma.product.count({ where: variation }),
    prisma.product.findMany({ where: variation, select: itemSelect, orderBy, take: LIST_LIMIT }),
    prisma.product.count({ where: affectedParents }),
  ])

  return {
    simple: { count: simpleCount, items: simpleRows.map(toItem) },
    variation: { count: variationCount, parentCount, items: variationRows.map(toItem) },
  }
}

export async function getProductTypeTotals(
  rootCategoryId: number | null
): Promise<ProductTypeTotals> {
  const scope = await scopeFor(rootCategoryId)
  const prisma = getPrisma()

  const [simple, variable, variations] = await Promise.all([
    prisma.product.count({ where: simpleWhere(scope) }),
    prisma.product.count({ where: variableWhere(scope) }),
    prisma.product.count({ where: variationWhere(scope) }),
  ])

  return { simple, variable, variations }
}

/**
 * Produk induk terbaru menurut `importedAt`.
 *
 * Kolom itu berisi saat baris masuk ke database ini: untuk produk hasil impor
 * WooCommerce artinya tanggal impor, untuk produk yang dibuat di panel artinya
 * tanggal dibuat. Belum ada kolom "tanggal dibuat" terpisah.
 */
export async function getLatestProducts(): Promise<LatestProductItem[]> {
  const rows = await getPrisma().product.findMany({
    where: { parentId: null, status: { in: ACTIVE_PRODUCT_STATUSES } },
    select: { ...itemSelect, type: true, importedAt: true, _count: { select: { variations: true } } },
    orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    take: LIST_LIMIT,
  })

  return rows.map((row) => ({
    ...toItem(row),
    type: row.type,
    variationCount: row._count.variations,
    importedAt: row.importedAt,
  }))
}

export async function getRecentProductLogs(filter: LogFilter): Promise<DashboardLogItem[]> {
  const where: Prisma.ProductLogWhereInput =
    filter === "all" ? {} : filter === "price" ? { action: { in: PRICE_ACTIONS } } : { action: filter }

  const rows = await getPrisma().productLog.findMany({
    where,
    // `id` sebagai pemecah seri — satu penyimpanan bisa menulis beberapa baris
    // dengan `createdAt` yang sama persis.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LOG_LIMIT,
    select: {
      id: true,
      userName: true,
      productName: true,
      action: true,
      fieldAffected: true,
      oldValue: true,
      newValue: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({ ...row, productName: decodeHtmlEntities(row.productName) }))
}

/** Aksi yang benar-benar ada isinya — pilihan penyaring kartu log. */
export async function getProductLogActions(): Promise<string[]> {
  const groups = await getPrisma().productLog.groupBy({
    by: ["action"],
    orderBy: { action: "asc" },
  })
  return groups.map((group) => group.action)
}
