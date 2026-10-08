import "server-only"

import { Prisma, StockStatus } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { invalidateProductCaches } from "@/lib/api/woocommerce/products"
import { fetchAllHnsItems, type HnsItem } from "@/lib/api/hns-data/client"

/**
 * Sinkron STOK & HPP dari API Data Accurate ke katalog web (docs/13 §10).
 *
 * Satu arah, dan sempit dengan sengaja:
 *  - yang ditulis ke `products` HANYA `stock_qty`, `stock_status`, dan
 *    `stock_synced_at` — tidak pernah harga (web sumber harga, docs/13 §1);
 *  - HPP tinggal di `accurate_items.cost`, tidak pernah masuk `products`
 *    (lihat komentar model `AccurateItem`);
 *  - pencocokan lewat `products.accurate_code` ↔ kode barang (SKU Accurate),
 *    penambat yang sama dengan halaman Update Harga.
 */

/**
 * Gudang yang dihitung sebagai stok web — keputusan 9 Oktober 2026: lima gudang
 * jual ditambah dua gudang DISPLAY (unit pajangan dianggap bisa dijual).
 *
 * Dikunci ID gudang Accurate, bukan nama: nama bisa diganti di Accurate, ID
 * tidak. Yang SENGAJA tidak ikut: HADIAH, INVENTARIS NAGOYA GATEWAY, GUDANG
 * PAMERAN, OTW, KLAIM GARANSI, Transit — barangnya ada tapi bukan untuk dijual.
 * Mengubah daftar ini mengubah stok yang dilihat pelanggan; catat di docs/13 §10.
 */
export const GUDANG_STOK_WEB: ReadonlyMap<number, string> = new Map([
  [50, "GUDANG UTAMA"],
  [100, "GUDANG BATAM"],
  [250, "GATEWAY"],
  [350, "GRIYA"],
  [400, "NAGOYAHILL"],
  [500, "GUDANG DISPLAY GATEWAY"],
  [2250, "GUDANG DISPLAY NAGOYAHILL"],
])

/** Stok di gudang web. Gudang yang tidak tercantum tidak ikut, berapa pun isinya. */
export function hitungStokWeb(item: Pick<HnsItem, "stock">): number {
  return (item.stock?.warehouses ?? [])
    .filter((w) => GUDANG_STOK_WEB.has(w.id))
    .reduce((total, w) => total + (Number.isFinite(w.quantity) ? w.quantity : 0), 0)
}

export type SyncTrigger = "manual" | "webhook"

export type SyncResult =
  | {
      ok: true
      runId: number
      itemsReceived: number
      productsUpdated: number
      productsSkippedZero: number
      unlinkedWithStock: number
    }
  | { ok: true; duplicate: true }

const angka = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null)
const tanggal = (s: string | null | undefined) => {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Simpan salinan barang ke `accurate_items` — satu `INSERT … ON DUPLICATE KEY
 * UPDATE` per 300 barang, bukan satu upsert per barang. ±6.100 barang lewat
 * upsert satuan berarti ribuan kueri per sinkron; batas Hostinger 500 koneksi
 * per jam sudah pernah habis oleh hal yang jauh lebih kecil.
 */
async function simpanSalinan(items: HnsItem[], now: Date): Promise<void> {
  const prisma = getPrisma()
  for (let i = 0; i < items.length; i += 300) {
    const potong = items.slice(i, i + 300)
    const baris = potong.map((it) => {
      const gudang = (it.stock?.warehouses ?? []).map((w) => ({ id: w.id, name: w.name, quantity: w.quantity }))
      return Prisma.sql`(${it.id}, ${String(it.sku).trim().slice(0, 50)}, ${String(it.name).slice(0, 255)},
        ${String(it.type).slice(0, 16)}, ${it.category?.name?.slice(0, 191) ?? null},
        ${it.brand?.name?.slice(0, 191) ?? null}, ${it.unit?.slice(0, 32) ?? null}, ${String(it.status).slice(0, 16)},
        ${hitungStokWeb(it)}, ${angka(it.stock?.total) ?? 0}, ${JSON.stringify(gudang)},
        ${angka(it.cost)}, ${tanggal(it.accurateUpdatedAt)}, ${tanggal(it.changedAt)}, ${now})`
    })
    await prisma.$executeRaw`
      INSERT INTO accurate_items
        (id, code, name, type, category_name, brand_name, unit, status,
         stock_web, stock_total, stock_by_warehouse, cost, accurate_updated_at, changed_at, synced_at)
      VALUES ${Prisma.join(baris)}
      ON DUPLICATE KEY UPDATE
        code = VALUES(code), name = VALUES(name), type = VALUES(type),
        category_name = VALUES(category_name), brand_name = VALUES(brand_name),
        unit = VALUES(unit), status = VALUES(status), stock_web = VALUES(stock_web),
        stock_total = VALUES(stock_total), stock_by_warehouse = VALUES(stock_by_warehouse),
        cost = VALUES(cost), accurate_updated_at = VALUES(accurate_updated_at),
        changed_at = VALUES(changed_at), synced_at = VALUES(synced_at)`
  }
}

/** Barang Accurate berstok (gudang web) yang belum punya produk web & belum ditandai diabaikan. */
async function hitungBelumTertaut(): Promise<number> {
  const [row] = await getPrisma().$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n
    FROM accurate_items ai
    LEFT JOIN products p ON p.accurate_code = ai.code
    LEFT JOIN accurate_ignored ig ON ig.kode_accurate = ai.code
    WHERE ai.stock_web > 0 AND ai.type = 'INVENTORY' AND ai.status = 'active'
      AND p.id IS NULL AND ig.kode_accurate IS NULL`
  return Number(row?.n ?? 0)
}

/**
 * Terapkan sekumpulan barang Accurate ke katalog. Dipakai tombol admin (seluruh
 * barang) dan webhook (barang yang berubah saja, 100 per kiriman).
 *
 * **Aturan "prioritas yang ada stok"** (keputusan 9 Oktober 2026): produk
 * tertaut yang stok web-nya 0 dan BELUM PERNAH disinkron (`stock_synced_at`
 * NULL) dilewati — staff memilih mengerjakan yang berstok lebih dulu. Produk
 * yang PERNAH disinkron tetap diperbarui walau stoknya jatuh ke 0, supaya
 * barang yang laku habis tidak membeku dengan stok lamanya.
 *
 * Hanya barang ber-jenis INVENTORY yang menulis stok: jasa dan non-persediaan
 * tidak punya stok yang berarti, dan menulis 0 ke produk jasa akan menandainya
 * habis.
 */
export async function syncAccurateItems(
  items: HnsItem[],
  opts: { trigger: SyncTrigger; userName?: string | null; deliveryId?: string | null; sourceSyncedAt?: string | null },
): Promise<SyncResult> {
  const prisma = getPrisma()
  const now = new Date()

  let runId: number
  try {
    const run = await prisma.accurateSyncRun.create({
      data: {
        trigger: opts.trigger,
        userName: opts.userName ?? null,
        deliveryId: opts.deliveryId ?? null,
        startedAt: now,
        itemsReceived: items.length,
        sourceSyncedAt: tanggal(opts.sourceSyncedAt),
      },
      select: { id: true },
    })
    runId = run.id
  } catch (error) {
    // Kiriman webhook yang sama datang dua kali — sudah diproses, abaikan.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && opts.deliveryId) {
      return { ok: true, duplicate: true }
    }
    throw error
  }

  try {
    await simpanSalinan(items, now)

    // Kode → barang. Dibandingkan huruf besar & tanpa spasi tepi, sama seperti
    // pemeriksaan penautan; kolom `accurate_code` sendiri ber-collation
    // case-insensitive, jadi kueri IN di bawah juga cocok tanpa peduli huruf.
    const barangPerKode = new Map<string, HnsItem>()
    for (const it of items) {
      if (it.type !== "INVENTORY") continue
      barangPerKode.set(String(it.sku).trim().toUpperCase(), it)
    }

    const produk: {
      id: number
      wooId: number
      slug: string
      parentId: number | null
      accurateCode: string | null
      stockQty: number | null
      stockStatus: StockStatus | null
      stockSyncedAt: Date | null
    }[] = []
    const kode = [...barangPerKode.keys()]
    for (let i = 0; i < kode.length; i += 1000) {
      produk.push(
        ...(await prisma.product.findMany({
          where: { accurateCode: { in: kode.slice(i, i + 1000) } },
          select: {
            id: true,
            wooId: true,
            slug: true,
            parentId: true,
            accurateCode: true,
            stockQty: true,
            stockStatus: true,
            stockSyncedAt: true,
          },
        })),
      )
    }

    // Dikelompokkan per (jumlah, status) → satu UPDATE per kelompok, bukan per
    // produk. Stok yang sama sangat lazim (1, 2, 3 unit), jadi ±1.000 produk
    // jatuh ke beberapa puluh kueri saja.
    const kelompok = new Map<string, number[]>()
    const berubah: typeof produk = []
    let dilewatiNol = 0

    for (const p of produk) {
      const barang = barangPerKode.get(String(p.accurateCode).trim().toUpperCase())
      if (!barang) continue
      const qty = Math.max(0, Math.floor(hitungStokWeb(barang)))
      if (qty === 0 && p.stockSyncedAt === null) {
        dilewatiNol++
        continue
      }
      const status = qty > 0 ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK
      if (p.stockSyncedAt !== null && p.stockQty === qty && p.stockStatus === status) continue
      const kunci = `${qty}|${status}`
      kelompok.set(kunci, [...(kelompok.get(kunci) ?? []), p.id])
      berubah.push(p)
    }

    for (const [kunci, ids] of kelompok) {
      const [qty, status] = kunci.split("|")
      await prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { stockQty: Number(qty), stockStatus: status as StockStatus, stockSyncedAt: now },
      })
    }

    // Induk produk bervarian membaca status stok dari kolomnya SENDIRI
    // (db-mapper), jadi ia diselaraskan dengan variannya: Tersedia kalau ada
    // satu saja varian yang tersedia. Induk yang punya kode Accurate sendiri
    // dilewati — stoknya sudah ditulis di atas.
    const indukIds = [...new Set(berubah.map((p) => p.parentId).filter((x): x is number => x !== null))]
    const indukBerubah: { wooId: number; slug: string }[] = []
    for (let i = 0; i < indukIds.length; i += 500) {
      const induk = await prisma.product.findMany({
        where: { id: { in: indukIds.slice(i, i + 500) }, accurateCode: null },
        select: {
          id: true,
          wooId: true,
          slug: true,
          stockStatus: true,
          variations: { select: { stockStatus: true } },
        },
      })
      for (const ind of induk) {
        const ada = ind.variations.some((v) => v.stockStatus === StockStatus.INSTOCK)
        const status = ada ? StockStatus.INSTOCK : StockStatus.OUTOFSTOCK
        if (ind.stockStatus === status) continue
        await prisma.product.update({ where: { id: ind.id }, data: { stockStatus: status } })
        indukBerubah.push(ind)
      }
    }

    for (const p of [...berubah, ...indukBerubah]) {
      invalidateProductCaches({ wooId: p.wooId, slugs: [p.slug] })
    }
    // Varian tampil di halaman INDUKNYA; cache induk ikut disegarkan walau
    // status induknya sendiri tidak berubah.
    if (indukIds.length > 0) {
      const semuaInduk = await prisma.product.findMany({
        where: { id: { in: indukIds } },
        select: { wooId: true, slug: true },
      })
      for (const ind of semuaInduk) invalidateProductCaches({ wooId: ind.wooId, slugs: [ind.slug] })
    }

    const unlinkedWithStock = await hitungBelumTertaut()
    await prisma.accurateSyncRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        productsUpdated: berubah.length + indukBerubah.length,
        productsSkippedZero: dilewatiNol,
        unlinkedWithStock,
      },
    })

    return {
      ok: true,
      runId,
      itemsReceived: items.length,
      productsUpdated: berubah.length + indukBerubah.length,
      productsSkippedZero: dilewatiNol,
      unlinkedWithStock,
    }
  } catch (error) {
    await prisma.accurateSyncRun
      .update({
        where: { id: runId },
        data: {
          finishedAt: new Date(),
          error: error instanceof Error ? error.message.slice(0, 2000) : String(error),
          // Dilepas supaya kiriman ULANG dari Data Accurate (yang membawa
          // deliveryId yang sama) diproses lagi, bukan dianggap ganda — kalau
          // tidak, perubahan di kiriman yang gagal hilang untuk selamanya.
          deliveryId: null,
        },
      })
      .catch(() => {})
    throw error
  }
}

/** Tarik SELURUH barang dari API lalu terapkan — tombol "Sinkron Stok Sekarang". */
export async function syncAccurateStockFull(userName: string | null): Promise<SyncResult> {
  const { items, lastSyncAt } = await fetchAllHnsItems()
  return syncAccurateItems(items, { trigger: "manual", userName, sourceSyncedAt: lastSyncAt })
}

// ---------------------------------------------------------------- jalur baca

export type SyncRunSummary = {
  id: number
  trigger: string
  userName: string | null
  startedAt: string
  finishedAt: string | null
  itemsReceived: number
  productsUpdated: number
  productsSkippedZero: number
  unlinkedWithStock: number
  sourceSyncedAt: string | null
  error: string | null
}

export async function listRecentSyncRuns(take = 5): Promise<SyncRunSummary[]> {
  const rows = await getPrisma().accurateSyncRun.findMany({ orderBy: { startedAt: "desc" }, take })
  return rows.map((r) => ({
    id: r.id,
    trigger: r.trigger,
    userName: r.userName,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    itemsReceived: r.itemsReceived,
    productsUpdated: r.productsUpdated,
    productsSkippedZero: r.productsSkippedZero,
    unlinkedWithStock: r.unlinkedWithStock,
    sourceSyncedAt: r.sourceSyncedAt?.toISOString() ?? null,
    error: r.error,
  }))
}

/** Ringkasan untuk kepala tab: berapa produk yang stoknya kini dikelola Accurate. */
export async function countStockManagedProducts(): Promise<number> {
  return getPrisma().product.count({ where: { stockSyncedAt: { not: null } } })
}

export type UnlinkedStockItem = {
  code: string
  name: string
  categoryName: string | null
  brandName: string | null
  stockWeb: number
}

export const UNLINKED_PAGE_SIZE = 50

/**
 * Barang Accurate yang berstok di gudang web tapi belum punya produk web —
 * keputusan 9 Oktober 2026: DIDAFTAR untuk ditautkan staff, tidak dibuatkan
 * produk otomatis. Urut stok terbanyak: yang paling banyak tersedia paling
 * layak tayang lebih dulu. HPP sengaja TIDAK ikut di daftar ini.
 */
export async function listUnlinkedWithStock(opts: { q?: string; page?: number } = {}): Promise<{
  rows: UnlinkedStockItem[]
  total: number
  page: number
  pageCount: number
}> {
  const page = Math.max(1, opts.page ?? 1)
  const term = opts.q?.trim() ?? ""
  const cari = term.length >= 2 ? Prisma.sql`AND (ai.name LIKE ${`%${term}%`} OR ai.code LIKE ${`%${term}%`} OR ai.category_name LIKE ${`%${term}%`})` : Prisma.empty
  const dasar = Prisma.sql`
    FROM accurate_items ai
    LEFT JOIN products p ON p.accurate_code = ai.code
    LEFT JOIN accurate_ignored ig ON ig.kode_accurate = ai.code
    WHERE ai.stock_web > 0 AND ai.type = 'INVENTORY' AND ai.status = 'active'
      AND p.id IS NULL AND ig.kode_accurate IS NULL ${cari}`
  const prisma = getPrisma()
  const [[jumlah], rows] = await Promise.all([
    prisma.$queryRaw<{ n: bigint | number }[]>`SELECT COUNT(*) AS n ${dasar}`,
    prisma.$queryRaw<{ code: string; name: string; category_name: string | null; brand_name: string | null; stock_web: Prisma.Decimal }[]>`
      SELECT ai.code, ai.name, ai.category_name, ai.brand_name, ai.stock_web ${dasar}
      ORDER BY ai.stock_web DESC, ai.code ASC
      LIMIT ${UNLINKED_PAGE_SIZE} OFFSET ${(page - 1) * UNLINKED_PAGE_SIZE}`,
  ])
  const total = Number(jumlah?.n ?? 0)
  return {
    rows: rows.map((r) => ({
      code: r.code,
      name: r.name,
      categoryName: r.category_name,
      brandName: r.brand_name,
      stockWeb: Number(r.stock_web),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / UNLINKED_PAGE_SIZE)),
  }
}

export type AccurateStockInfo = {
  stockWeb: number
  stockTotal: number
  warehouses: { name: string; quantity: number; dihitung: boolean }[]
  /** `null` kalau pemanggil tidak berizin `harga-modal` — JANGAN diisi tanpa izin itu. */
  cost: number | null
  syncedAt: string
}

export type AccurateInfoRow = {
  /** Nama baris — nama produk, atau nama varian untuk produk bervarian. */
  label: string
  code: string
  /** `null` = kodenya belum pernah terbaca di sinkron (belum sinkron, atau kode tak dikenal Accurate). */
  info: AccurateStockInfo | null
}

/**
 * Data Accurate untuk satu produk di panel admin (halaman edit produk) — baris
 * produk itu sendiri kalau ia bertaut, ditambah tiap variannya yang bertaut.
 * Kode Accurate produk bervarian lazimnya menempel di VARIAN, bukan induknya.
 *
 * `bolehLihatModal` WAJIB dioper dari pemeriksaan izin `harga-modal` di
 * halamannya. HPP tidak pernah dikembalikan tanpa izin itu — bukan sekadar
 * disembunyikan di tampilan, tapi tidak ikut terkirim ke peramban sama sekali.
 */
export async function getAccurateInfoForProduct(
  wooId: number,
  bolehLihatModal: boolean,
): Promise<AccurateInfoRow[]> {
  const prisma = getPrisma()
  const produk = await prisma.product.findUnique({
    where: { wooId },
    select: {
      name: true,
      accurateCode: true,
      variations: { select: { name: true, accurateCode: true }, orderBy: { id: "asc" } },
    },
  })
  if (!produk) return []

  const baris = [
    ...(produk.accurateCode ? [{ label: produk.name, code: produk.accurateCode }] : []),
    ...produk.variations
      .filter((v) => v.accurateCode)
      .map((v) => ({
        // Nama varian = "<nama induk> - <label>"; yang membedakan cuma ekornya.
        label: v.name.startsWith(`${produk.name} - `) ? v.name.slice(produk.name.length + 3) : v.name,
        code: v.accurateCode as string,
      })),
  ]
  if (baris.length === 0) return []

  const items = await prisma.accurateItem.findMany({
    where: { code: { in: baris.map((b) => b.code.trim()) } },
    orderBy: { syncedAt: "desc" },
  })
  const perKode = new Map<string, (typeof items)[number]>()
  for (const it of items) {
    const k = it.code.trim().toUpperCase()
    if (!perKode.has(k)) perKode.set(k, it)
  }

  return baris.map((b) => {
    const item = perKode.get(b.code.trim().toUpperCase())
    if (!item) return { ...b, info: null }
    const gudang = Array.isArray(item.stockByWarehouse)
      ? (item.stockByWarehouse as { id: number; name: string; quantity: number }[])
      : []
    return {
      ...b,
      info: {
        stockWeb: Number(item.stockWeb),
        stockTotal: Number(item.stockTotal),
        warehouses: gudang.map((g) => ({ name: g.name, quantity: g.quantity, dihitung: GUDANG_STOK_WEB.has(g.id) })),
        cost: bolehLihatModal && item.cost !== null ? Number(item.cost) : null,
        syncedAt: item.syncedAt.toISOString(),
      },
    }
  })
}
