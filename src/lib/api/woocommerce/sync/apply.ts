import { getPrisma } from "@/lib/prisma/client"
import { buildProductLogEntries } from "@/lib/logs/product-log"
import { invalidateProductCaches } from "../products"
import { parseRemotePrice } from "./diff"
import { fetchRemoteProductsByIds } from "./remote"
import type { ApplyFailure, ApplyPriceResult, ApplySkip, RemoteProduct } from "./types"

/**
 * Menerapkan perubahan harga dari WooCommerce ke katalog kita.
 *
 * Tiga hal yang menentukan bentuk berkas ini:
 *
 * 1. **Harga tidak pernah datang dari klien.** Yang dikirim panel hanya daftar
 *    `wooId`. Harganya diambil ulang dari WooCommerce di sini. Kalau harga ikut
 *    dikirim dari browser, siapa pun yang bisa memanggil endpointnya bisa
 *    menetapkan harga apa saja — dan pratinjau yang berumur beberapa menit bisa
 *    menuliskan angka yang sudah kedaluwarsa (CLAUDE.md §2.7).
 *
 * 2. **Penjagaan yang sama seperti di pratinjau diulang di sini.** Pratinjau
 *    hanya menyarankan; yang menulis adalah berkas ini, jadi ia tidak boleh
 *    bergantung pada pemeriksaan yang sudah lewat. Induk variable, harga kosong,
 *    dan produk buatan panel ditolak lagi di titik penulisan.
 *
 * 3. **Tidak ada yang gagal diam-diam.** Setiap id yang diminta tapi tidak
 *    diterapkan dikembalikan beserta alasannya.
 */

/** Sekali penerapan tidak wajar melewati ini; katalognya sendiri ±3.300 produk. */
const MAX_IDS = 5000

/**
 * Sepotong per transaksi.
 *
 * Satu transaksi untuk ratusan produk berisiko melewati batas waktu, dan
 * kegagalan di baris ke-400 akan membatalkan 399 pembaruan yang sudah benar.
 * Dipotong supaya kegagalan terbatas pada potongannya sendiri, dan setiap
 * potongan tetap utuh — harga dan barisan lognya ditulis bersama atau tidak
 * sama sekali.
 */
const CHUNK = 50

type Candidate = {
  wooId: number
  productId: number
  name: string
  slug: string
  oldRegular: number | null
  oldSale: number | null
  newRegular: number | null
  newSale: number | null
}

/** Angka yang disimpan di log: harga apa adanya, kosong berarti "tidak ada". */
function logValue(price: number | null): string {
  return price === null ? "" : String(price)
}

function evaluate(
  wooId: number,
  remote: RemoteProduct | undefined,
  local:
    | {
        id: number
        wooId: number
        name: string
        slug: string
        source: string
        regularPrice: { toString(): string } | null
        salePrice: { toString(): string } | null
      }
    | undefined,
): { candidate: Candidate } | { skip: string } {
  // Sisi KITA diperiksa lebih dulu, dan urutannya bukan selera.
  //
  // Produk buatan panel admin umumnya tidak ada di WooCommerce, jadi kalau
  // ketiadaan di sisi WooCommerce diperiksa duluan, produk LOCAL akan ditolak
  // dengan alasan "tidak ada di WooCommerce" — benar hasilnya, menyesatkan
  // keterangannya, dan staff jadi mengira produknya terhapus di sana.
  if (!local) return { skip: "Tidak ada di katalog kita." }
  if (local.source === "LOCAL") return { skip: "Produk buatan panel admin — tidak disentuh sinkronisasi." }
  if (!remote) return { skip: "Tidak ada di WooCommerce (mungkin dihapus di sana)." }
  if (remote.type === "variable") {
    return { skip: "Induk produk variable tidak punya harga sendiri di WooCommerce." }
  }

  const newRegular = parseRemotePrice(remote.regular_price)
  const newSale = parseRemotePrice(remote.sale_price)
  const oldRegular = local.regularPrice === null ? null : Number(local.regularPrice.toString())
  const oldSale = local.salePrice === null ? null : Number(local.salePrice.toString())

  // Harga kosong di sumber berarti "tidak dinyatakan di sana", bukan "nol".
  // Sinkronisasi tidak pernah mengosongkan harga yang sudah ada.
  if (newRegular === null && oldRegular !== null) {
    return { skip: "Harga normal kosong di WooCommerce — tidak dipakai mengosongkan harga kita." }
  }

  const sameRegular = Math.round((oldRegular ?? 0) * 100) === Math.round((newRegular ?? 0) * 100)
    && (oldRegular === null) === (newRegular === null)
  const sameSale = Math.round((oldSale ?? 0) * 100) === Math.round((newSale ?? 0) * 100)
    && (oldSale === null) === (newSale === null)
  if (sameRegular && sameSale) return { skip: "Harga sudah sama." }

  return {
    candidate: {
      wooId,
      productId: local.id,
      name: local.name,
      slug: local.slug,
      oldRegular,
      oldSale,
      newRegular,
      newSale,
    },
  }
}

export async function applyPriceChanges(
  requestedIds: number[],
  userName: string,
): Promise<ApplyPriceResult> {
  const ids = [...new Set(requestedIds)].filter((id) => Number.isInteger(id) && id > 0)
  if (ids.length === 0) {
    return { applied: 0, skipped: [], failed: [], cacheInvalidated: true }
  }
  if (ids.length > MAX_IDS) {
    throw new Error(`Terlalu banyak produk sekaligus (${ids.length}). Batasnya ${MAX_IDS}.`)
  }

  const prisma = getPrisma()
  const [remoteProducts, localRows] = await Promise.all([
    fetchRemoteProductsByIds(ids),
    prisma.product.findMany({
      where: { wooId: { in: ids } },
      select: {
        id: true,
        wooId: true,
        name: true,
        slug: true,
        source: true,
        regularPrice: true,
        salePrice: true,
      },
    }),
  ])

  const remoteById = new Map(remoteProducts.map((product) => [product.id, product]))
  const localByWooId = new Map(localRows.map((row) => [row.wooId, row]))

  const candidates: Candidate[] = []
  const skipped: ApplySkip[] = []
  for (const wooId of ids) {
    const verdict = evaluate(wooId, remoteById.get(wooId), localByWooId.get(wooId))
    if ("skip" in verdict) skipped.push({ wooId, reason: verdict.skip })
    else candidates.push(verdict.candidate)
  }

  const failed: ApplyFailure[] = []
  const appliedSlugs: string[] = []
  const appliedWooIds: number[] = []

  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk = candidates.slice(i, i + CHUNK)
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of chunk) {
          await tx.product.update({
            where: { id: item.productId },
            data: { regularPrice: item.newRegular, salePrice: item.newSale },
          })

          const changes = []
          if (item.oldRegular !== item.newRegular) {
            changes.push({ field: "regular_price", old: logValue(item.oldRegular), new: logValue(item.newRegular) })
          }
          if (item.oldSale !== item.newSale) {
            changes.push({ field: "sale_price", old: logValue(item.oldSale), new: logValue(item.newSale) })
          }

          // Lewat helper bersama, bukan menyusun baris log sendiri — lihat
          // catatan di lib/logs/product-log.ts soal dua penulis yang menyimpang.
          for (const entry of buildProductLogEntries(changes, { priceAction: "SYNC_PRICE" })) {
            await tx.productLog.create({
              data: {
                userName,
                productId: item.wooId,
                productName: item.name,
                action: entry.action,
                fieldAffected: entry.fieldAffected,
                oldValue: entry.oldValue,
                newValue: entry.newValue,
              },
            })
          }
        }
      }, { timeout: 30000 })

      for (const item of chunk) {
        appliedSlugs.push(item.slug)
        appliedWooIds.push(item.wooId)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan."
      for (const item of chunk) failed.push({ wooId: item.wooId, message })
    }
  }

  // Dijalankan SETELAH seluruh penulisan selesai, dan kegagalannya tidak boleh
  // menghapus fakta bahwa harganya sudah tersimpan.
  let cacheInvalidated = true
  try {
    for (const wooId of appliedWooIds) invalidateProductCaches({ wooId })
    if (appliedSlugs.length > 0) invalidateProductCaches({ slugs: appliedSlugs })
  } catch {
    cacheInvalidated = false
  }

  return { applied: appliedWooIds.length, skipped, failed, cacheInvalidated }
}
