import "server-only"

import { createHash } from "crypto"
import { cache } from "react"

import { getPrisma } from "@/lib/prisma/client"

export type QuoteLineItem = {
  productId: number
  name: string
  sku: string | null
  image?: string
  price: number
  quantity: number
  stepName: string | null
  /**
   * Opsi varian yang dipilih pelanggan, mis. "1TB · Hitam" — beserta nama
   * induknya. Keduanya `undefined` untuk komponen biasa.
   *
   * Kolom `items` bertipe Json, jadi menambah medan di sini TIDAK butuh
   * migrasi dan TIDAK merusak baris lama: quotation yang dicetak sebelum
   * medan ini ada tinggal tidak memilikinya, dan pembacanya jatuh ke `name`.
   *
   * Kenapa dicatat terpisah dan tidak diandalkan dari `name` saja: nama baris
   * varian tidak bisa dipercaya sebagai pembeda — varian warisan impor
   * WooCommerce sering hanya mengulang nama induknya utuh, sehingga dua baris
   * di build log bisa terbaca identik untuk dua barang yang berbeda harga.
   * Lihat `lib/utils/variation.ts`.
   *
   * TIDAK ikut ke `computeContentHash`: yang menentukan identitas dokumen
   * adalah id, kuantitas, dan harga. Varian yang berbeda sudah pasti id yang
   * berbeda, jadi menambahkannya ke hash tidak memisahkan apa pun yang belum
   * terpisah — tapi akan menerbitkan kode baru untuk quotation lama yang isinya
   * tidak berubah sama sekali.
   */
  parentName?: string | null
  variationLabel?: string | null
}

/**
 * Sidik jari isi rakitan. Dihitung dari `productId:qty:harga` yang DIURUTKAN
 * lebih dulu, supaya urutan pemilihan komponen tidak menghasilkan hash berbeda
 * untuk rakitan yang sebenarnya identik.
 *
 * Harga ikut di-hash dengan sengaja: quotation adalah dokumen penawaran, jadi
 * isi yang sama pada harga berbeda adalah penawaran yang BERBEDA dan harus
 * punya kode sendiri. Kalau harga diabaikan, mencetak ulang rakitan yang sama
 * setelah harga naik akan menimpa snapshot lama — dokumen yang sudah dipegang
 * pelanggan jadi tidak cocok lagi dengan yang tersimpan, dan halaman verifikasi
 * kehilangan kemampuannya menandai selisih harga.
 */
function computeContentHash(items: QuoteLineItem[]): string {
  const normalized = items
    .map((item) => `${item.productId}:${item.quantity}:${item.price}`)
    .sort()
    .join(",")

  return createHash("sha256").update(normalized).digest("hex")
}

/**
 * `HNSPC-260804-7K3M` — tanggal terbit + 4 karakter dari hash.
 *
 * Sengaja BUKAN nomor berurutan: urutan seperti HNSPC00001 membocorkan berapa
 * banyak quotation yang sudah pernah dibuat kepada siapa pun yang memegang dua
 * dokumen berbeda.
 */
function buildQuoteCode(contentHash: string, issuedAt: Date): string {
  const yy = String(issuedAt.getFullYear()).slice(-2)
  const mm = String(issuedAt.getMonth() + 1).padStart(2, "0")
  const dd = String(issuedAt.getDate()).padStart(2, "0")

  // Base36 dari potongan hash: 0-9 + A-Z, mudah dibaca & diketik ulang.
  const suffix = parseInt(contentHash.slice(0, 8), 16)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0")
    .slice(-4)

  return `HNSPC-${yy}${mm}${dd}-${suffix}`
}

/**
 * Catat quotation. Mengembalikan kode yang tersimpan.
 *
 * Rakitan dengan isi DAN harga yang sama persis tidak membuat baris baru — yang
 * berubah cuma `updatedAt`, penanda kapan terakhir dokumen itu dicetak ulang.
 * Snapshot-nya sendiri sengaja TIDAK pernah ditimpa: dokumen yang sudah dicetak
 * pelanggan harus selamanya cocok dengan yang tersimpan, supaya `/verify/[code]`
 * bisa dipercaya sebagai bukti penawaran. Harga baru = penawaran baru = kode
 * baru (lihat `computeContentHash`).
 *
 * Kegagalan di sini TIDAK boleh menggagalkan pencetakan — dokumen tetap harus
 * bisa keluar walau pencatatan gagal, jadi pemanggilnya menangani error.
 *
 * Penulisannya di-dedupe per `contentHash` lewat `cache()`, bukan per argumen:
 * setiap render mengirim array baru, jadi `cache()` yang membungkus fungsi ini
 * langsung tidak akan pernah kena. Tanpa dedupe, render ulang React (Strict
 * Mode menjalankan effect & render dua kali di dev) membuat `updatedAt` maju
 * beberapa milidetik setelah `createdAt` walau pelanggan baru mencetak SEKALI —
 * kolom "Diperbarui" di admin jadi tampak seperti ada cetak ulang yang tidak
 * pernah terjadi.
 */
export async function recordPcBuildQuote(items: QuoteLineItem[]) {
  return upsertQuoteByHash(computeContentHash(items), JSON.stringify(items))
}

/**
 * SEMUA argumen di sini sengaja berupa string primitif.
 *
 * `cache()` mengunci pada identitas tiap argumen, jadi mengoper array `items`
 * apa adanya membuat memoisasi tidak pernah kena — setiap render membuat array
 * baru, dan array baru selalu dianggap argumen yang berbeda. Dengan hash +
 * JSON, dua render dengan isi rakitan sama menghasilkan kunci yang identik dan
 * database benar-benar cuma disentuh sekali per permintaan.
 */
const upsertQuoteByHash = cache(async function upsertQuoteByHash(
  contentHash: string,
  itemsJson: string
) {
  const prisma = getPrisma()
  const items = JSON.parse(itemsJson) as QuoteLineItem[]
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const issuedAt = new Date()

  const quote = await prisma.pcBuildQuote.upsert({
    where: { contentHash },
    // Hanya menyentuh `updatedAt` (diisi otomatis oleh `@updatedAt`) — kolom
    // lain dibiarkan apa adanya supaya snapshot tetap utuh.
    update: {},
    create: {
      items,
      subtotal,
      // Jasa rakit sekarang jadi step biasa di PC Builder, jadi nilainya sudah
      // ikut di `subtotal`. Kolomnya dipertahankan untuk membaca quotation lama
      // yang biayanya masih terpisah.
      assemblyFee: 0,
      total: subtotal,
      itemCount: items.length,
      code: buildQuoteCode(contentHash, issuedAt),
      contentHash,
      createdAt: issuedAt,
    },
  })

  return { code: quote.code }
})

/**
 * Dipakai halaman verifikasi /verify/[code] — halaman kasir yang dijaga izin
 * `verify`. Tetap JANGAN meng-`include` relasi `submissions` di sini: kasir
 * cukup melihat isi quotation, bukan nama & nomor WhatsApp pengirimnya.
 */
export async function getQuoteByCode(code: string) {
  const prisma = getPrisma()
  return prisma.pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
  })
}

/**
 * Ringkasan satu quotation untuk daftar & hasil pencarian di /verify.
 *
 * Tanggal berupa string ISO, bukan `Date`: bentuk yang sama dipakai halaman
 * server DAN dikirim sebagai JSON dari route pencarian, jadi pemanggil di kedua
 * sisi tidak perlu dua tipe. `items` sengaja tidak ikut — kolom Json itu bisa
 * berisi puluhan baris, dan daftar hanya butuh jumlahnya.
 */
export type QuoteSummary = {
  code: string
  total: number
  itemCount: number
  createdAt: string
  /** Terakhir dicetak — maju setiap kali rakitan yang sama persis dicetak ulang. */
  updatedAt: string
}

/**
 * `dicetak` = `updatedAt` (terakhir dicetak), `dibuat` = `createdAt`.
 *
 * Bawaannya `dicetak` karena itulah yang dicari kasir: pelanggan yang datang
 * membawa cetakan baru dari rakitan yang pernah dicetak sebelumnya TIDAK
 * mendapat kode baru, jadi kalau diurutkan menurut tanggal dibuat, quotation
 * yang baru saja ia cetak bisa terkubur jauh di bawah.
 */
export type QuoteSort = "dicetak" | "dibuat"

export function parseQuoteSort(value: unknown): QuoteSort {
  return value === "dibuat" ? "dibuat" : "dicetak"
}

const QUOTE_SUMMARY_SELECT = {
  code: true,
  total: true,
  itemCount: true,
  createdAt: true,
  updatedAt: true,
} as const

function toQuoteSummary(row: {
  code: string
  total: { toString(): string }
  itemCount: number
  createdAt: Date
  updatedAt: Date
}): QuoteSummary {
  return {
    code: row.code,
    total: Number(row.total),
    itemCount: row.itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Quotation terakhir untuk grid di /verify. */
export async function listRecentQuotes(sort: QuoteSort, limit = 15): Promise<QuoteSummary[]> {
  const rows = await getPrisma().pcBuildQuote.findMany({
    select: QUOTE_SUMMARY_SELECT,
    orderBy: sort === "dibuat" ? { createdAt: "desc" } : { updatedAt: "desc" },
    take: limit,
  })
  return rows.map(toQuoteSummary)
}

/**
 * Normalisasi teks pencarian kode: huruf besar, tanpa spasi, hanya karakter
 * yang memang bisa ada di kode (`A-Z`, `0-9`, `-`). Null kalau terlalu pendek
 * untuk dicari — dua karakter sudah cukup menyempitkan, satu karakter hampir
 * mencocokkan semua baris.
 */
export function normalizeQuoteSearchTerm(raw: string): string | null {
  const term = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32)
  return term.length >= 2 ? term : null
}

/**
 * Cari quotation yang kodenya MENGANDUNG `term` — kasir boleh mengetik bagian
 * mana saja: akhiran `VVGT`, tanggal `260804`, atau awalan `HNSPC-2608`.
 *
 * `contains` berarti `LIKE '%term%'` yang tidak memakai indeks. Diterima dengan
 * sadar: satu baris per rakitan yang dicetak, dan kolomnya pendek. Kalau suatu
 * hari terasa lambat, jalan pertama adalah mencari awalan saja.
 */
export async function searchQuotesByCode(term: string, limit = 8): Promise<QuoteSummary[]> {
  const rows = await getPrisma().pcBuildQuote.findMany({
    where: { code: { contains: term } },
    select: QUOTE_SUMMARY_SELECT,
    orderBy: { updatedAt: "desc" },
    take: limit,
  })
  return rows.map(toQuoteSummary)
}

/**
 * Harga & gambar TERKINI untuk produk-produk di sebuah quotation.
 *
 * - `price`: harga katalog saat ini (salePrice kalau ada, selain itu
 *   regularPrice) — untuk menandai baris yang harganya sudah berubah.
 * - `image`: cadangan untuk quotation lama yang snapshot-nya belum menyimpan
 *   gambar. Aturannya sama dengan halaman cetak: gambar varian, kalau kosong
 *   gambar induknya.
 *
 * Produk yang sudah dihapus tidak ada di peta; pemanggil memperlakukannya
 * sebagai "tidak diketahui".
 */
export async function getQuoteProductsCurrentInfo(
  productIds: number[]
): Promise<Map<number, { price: number; image: string | null }>> {
  if (productIds.length === 0) return new Map()

  const products = await getPrisma().product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      regularPrice: true,
      salePrice: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      parent: {
        select: {
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  })

  return new Map(
    products.map((p) => {
      const sale = p.salePrice ? Number(p.salePrice) : 0
      const regular = p.regularPrice ? Number(p.regularPrice) : 0
      return [
        p.id,
        {
          price: sale > 0 ? sale : regular,
          image: p.images[0]?.url ?? p.parent?.images[0]?.url ?? null,
        },
      ]
    })
  )
}
