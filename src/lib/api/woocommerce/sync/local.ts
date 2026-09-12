import { getPrisma } from "@/lib/prisma/client"
import type { LocalProduct } from "./types"

/**
 * Keadaan katalog kita, dibaca sekali lalu dipakai membandingkan.
 *
 * Sengaja satu perjalanan ke database untuk seluruh katalog (±5.200 baris,
 * beberapa kolom saja) alih-alih satu kueri per produk. Batas koneksi MariaDB
 * di Hostinger 500 per jam, dan pola satu-kueri-per-produk sudah pernah
 * menghabiskannya sendirian.
 */
export type LocalCatalogSnapshot = {
  byWooId: Map<number, LocalProduct>
  /**
   * Kapan katalog terakhir diisi dari WooCommerce. Ini yang memisahkan produk
   * yang benar-benar baru dari yang tertinggal saat import — lihat
   * `NewProductGroup` di `types.ts`. `null` kalau belum ada baris WOO sama
   * sekali (database baru).
   */
  lastImportedAt: Date | null
  /**
   * Nama kategori kita (huruf besar, termasuk daun dari tiap `path`) -> id.
   *
   * Map, bukan Set: pratinjau hanya perlu tahu "cocok atau tidak", tapi import
   * butuh id-nya untuk benar-benar memasang kategori. Satu struktur melayani
   * keduanya.
   */
  categoryIdByName: Map<string, number>
  /** wooId yang harganya pernah disunting staff lewat panel admin. */
  priceEditedWooIds: Set<number>
}

/** `Decimal` Prisma -> number biasa. Rupiah tidak pernah mendekati batas presisi `number`. */
function toNumber(value: { toString(): string } | null): number | null {
  if (value === null) return null
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Aksi di `product_logs` yang berarti "seseorang menetapkan harga di sini".
 *
 * `EDIT_PRODUCT` dengan `field_affected = 'multiple'` ikut dihitung: form
 * produk menyimpan beberapa medan sekaligus dan meringkasnya jadi satu baris,
 * jadi harga bisa termasuk di dalamnya tanpa disebut namanya. Lebih baik
 * menandai beberapa produk secara berlebihan daripada melewatkan yang harganya
 * memang pernah ditetapkan orang.
 */
const PRICE_LOG_FIELDS = ["regular_price", "sale_price", "price", "multiple"]

export async function getLocalCatalogSnapshot(): Promise<LocalCatalogSnapshot> {
  const prisma = getPrisma()

  const [rows, lastImport, categories, priceLogs] = await Promise.all([
    prisma.product.findMany({
      select: { wooId: true, name: true, source: true, regularPrice: true, salePrice: true },
    }),
    prisma.product.aggregate({
      _max: { importedAt: true },
      where: { source: "WOO" },
    }),
    prisma.category.findMany({ select: { id: true, name: true, path: true, depth: true } }),
    prisma.productLog.findMany({
      // `SYNC_PRICE` dikecualikan: itu jejak penerapan sinkronisasi, bukan
      // keputusan orang. Tanpa ini, sekali penerapan membuat seluruh produk
      // tertandai "pernah disunting di panel" dan tandanya berhenti berguna.
      where: { fieldAffected: { in: PRICE_LOG_FIELDS }, action: { not: "SYNC_PRICE" } },
      select: { productId: true },
      distinct: ["productId"],
    }),
  ])

  const byWooId = new Map<number, LocalProduct>()
  for (const row of rows) {
    byWooId.set(row.wooId, {
      wooId: row.wooId,
      name: row.name,
      source: row.source,
      regularPrice: toNumber(row.regularPrice),
      salePrice: toNumber(row.salePrice),
    })
  }

  // Nama yang sama bisa muncul di beberapa cabang ("COLORFUL" ada di bawah
  // LAPTOP OFFICE dan LAPTOP GAMING). Yang dipertahankan adalah yang PALING
  // DALAM: kategori terdalam adalah yang paling spesifik, dan itu yang
  // dijadikan kategori utama produk.
  const depthByName = new Map<string, number>()
  const categoryIdByName = new Map<string, number>()
  const daftarkan = (nama: string, id: number, depth: number) => {
    const kunci = nama.toUpperCase().trim()
    if (kunci === "") return
    const sebelumnya = depthByName.get(kunci)
    if (sebelumnya !== undefined && sebelumnya >= depth) return
    depthByName.set(kunci, depth)
    categoryIdByName.set(kunci, id)
  }
  for (const category of categories) {
    daftarkan(category.name, category.id, category.depth)
    // Slug kategori kita memakai path penuh ("KOMPONEN PC > MOTHERBOARD >
    // MOTHERBOARD INTEL"). Yang dibandingkan dengan WooCommerce adalah daunnya.
    const leaf = category.path.split(">").pop()
    if (leaf) daftarkan(leaf, category.id, category.depth)
  }

  return {
    byWooId,
    lastImportedAt: lastImport._max.importedAt,
    categoryIdByName,
    // `productId` di tabel log menyimpan wooId, bukan id internal — pola lama
    // yang dipakai konsisten di seluruh panel admin.
    priceEditedWooIds: new Set(priceLogs.map((log) => log.productId)),
  }
}
