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

/** Dipakai halaman verifikasi publik /verify/[code]. */
export async function getQuoteByCode(code: string) {
  const prisma = getPrisma()
  return prisma.pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
  })
}
