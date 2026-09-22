import "server-only"

import { createHash } from "crypto"

import type { Prisma } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"
import { jakartaMonthRange, jakartaPeriod, jakartaYyyymmdd } from "@/lib/utils/timezone"

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
 * `HNSPC-20260921-0001` — tanggal terbit (WIB) + nomor urut dalam bulan itu.
 *
 * **Keputusan 21 September 2026.** Sampai hari ini kodenya berakhiran 4 karakter
 * dari hash isi, dan komentar di sini menyatakan urutan sengaja dihindari karena
 * "membocorkan berapa banyak quotation yang sudah pernah dibuat". Alasan itu
 * masih benar — dua dokumen memang cukup untuk memperkirakan volume per bulan —
 * tapi HNS memilih nomor urut dengan sadar: quotation kini alat kerja tim toko
 * yang harus bisa disebut lewat telepon, dicatat di buku, dan diurutkan.
 *
 * Dua hal yang menahan risikonya, dan keduanya harus tetap ada:
 * 1. Nomor hanya terbit lewat aksi eksplisit, bukan sebagai efek samping GET
 *    halaman cetak — refresh tab PDF tidak menghabiskan nomor.
 * 2. Rate limit per IP untuk penerbitan oleh non-staff.
 *
 * Tanggalnya **WIB**, bukan waktu server. Container produksi berjalan di UTC;
 * tanpa penerjemahan itu, cetakan pukul 00.30 WIB tanggal 1 masuk periode bulan
 * sebelumnya dan mengambil nomor lanjutan yang seharusnya sudah di-reset.
 *
 * Nomor boleh melewati 9999 (jadi 5 digit). Kehabisan nomor adalah kegagalan
 * yang jauh lebih buruk daripada kode yang lebih panjang satu karakter.
 */
function buildQuoteCode(issuedAt: Date, sequence: number): string {
  return `HNSPC-${jakartaYyyymmdd(issuedAt)}-${String(sequence).padStart(4, "0")}`
}

/**
 * Ambil nomor berikutnya untuk sebuah periode, di dalam transaksi pemanggil.
 *
 * Satu pernyataan `INSERT … ON DUPLICATE KEY UPDATE`, bukan
 * `SELECT … FOR UPDATE` lalu `UPDATE`. Bedanya penting di bawah beban: pola
 * SELECT-lalu-UPDATE mengambil kunci berbagi dulu, lalu menaikkannya jadi kunci
 * eksklusif — dan dua transaksi yang sama-sama sudah memegang kunci berbagi atas
 * baris yang sama akan saling menunggu selamanya (deadlock). Bentuk di bawah
 * langsung mengambil kunci eksklusif, jadi penerbitan bersamaan mengantre.
 *
 * `SELECT` sesudahnya aman membaca hasilnya sendiri: kuncinya masih dipegang
 * sampai transaksi pemanggil selesai, jadi tidak ada yang bisa menyelip di
 * antara keduanya.
 */
async function nextQuoteSequence(
  tx: Prisma.TransactionClient,
  period: string
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO pc_build_quote_counters (period, last_number)
    VALUES (${period}, 1)
    ON DUPLICATE KEY UPDATE last_number = last_number + 1
  `

  const rows = await tx.$queryRaw<{ last_number: number | bigint }[]>`
    SELECT last_number FROM pc_build_quote_counters WHERE period = ${period}
  `

  const value = rows[0]?.last_number
  if (value === undefined) {
    // Tidak mungkin terjadi — barisnya baru saja ditulis di transaksi yang sama.
    // Dilempar alih-alih jatuh ke 0 supaya nomor ganda tidak pernah lolos diam-diam.
    throw new Error(`Penghitung quotation periode ${period} hilang setelah ditulis`)
  }

  return Number(value)
}

/**
 * Identitas pelanggan + siapa yang memegang quotation.
 *
 * `undefined` seluruhnya = cetakan anonim (pengunjung). Tidak ada id akun yang
 * disimpan sama sekali untuk kasus itu — data pribadi paling aman adalah yang
 * tidak disimpan (CLAUDE.md §2.8).
 *
 * Perbedaan `ownerUserId` dan `createdByUserId` adalah inti alur operan:
 *  - keduanya SAMA  → sales menerbitkan untuk dirinya, atau CS memilih "tidak oper"
 *  - keduanya BEDA  → CS mengoper ke sales; itulah yang menampilkan badge
 *                     "Dioper dari CS" dan memicu notifikasi ke sales penerima.
 *
 * `salesName` adalah SALINAN nama tampilan pemilik saat terbit, dan sengaja
 * dikirim oleh pemanggil alih-alih dibaca di sini: yang tahu apakah pemiliknya
 * berperan Sales adalah lapisan yang sudah memuat izinnya.
 */
export type QuotationOwner = {
  customerName: string | null
  customerPhone: string | null
  internalNote: string | null
  ownerUserId: string | null
  salesName: string | null
  createdByUserId: string | null
}

/**
 * Tulis satu quotation baru bernomor dari snapshot yang SUDAH berharga.
 *
 * Lapisan terendah: ia tidak membaca katalog dan tidak memeriksa izin apa pun.
 * Pemanggil yang sudah memegang harga hasil `priceCartFromCatalog` (jalur
 * "Kirim ke HNS") memakainya langsung; jalur cetak lewat `issueQuotation()`
 * di bawah, yang membaca katalog lebih dulu.
 *
 * **Satu panggilan = satu dokumen baru bernomor.** Sampai 21 September 2026
 * fungsi ini men-dedupe per `contentHash`: rakitan dengan isi dan harga sama
 * persis memakai ulang baris yang sudah ada. Itu dilepas bersamaan dengan
 * masuknya pemilik, nama pelanggan, dan status jual — dua penawaran untuk dua
 * orang berbeda tidak boleh jadi satu baris hanya karena isinya kebetulan sama.
 * Alasan lengkapnya ada di komentar model `PcBuildQuote` dan di migrasi
 * `20260921093118_quotation_sales_revisions`.
 *
 * Kegagalan di sini TIDAK boleh menggagalkan pencetakan — dokumen tetap harus
 * bisa keluar walau pencatatan gagal, jadi pemanggilnya menangani error.
 *
 * **`cache()` sudah dibuang di sini, dan itu disengaja.** Pembungkus itu ada
 * untuk menahan render ganda React saat halaman cetak masih menulis pada GET.
 * Sejak penerbitan pindah ke server action, tidak ada lagi render yang menulis:
 * satu aksi = satu panggilan. Memasangnya kembali justru berbahaya — ia akan
 * diam-diam menyatukan dua penerbitan berbeda yang isinya kebetulan sama di
 * dalam satu request.
 */
export async function recordPcBuildQuote(
  items: QuoteLineItem[],
  owner?: QuotationOwner
): Promise<{ code: string }> {
  const prisma = getPrisma()
  const contentHash = computeContentHash(items)
  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const issuedAt = new Date()
  const period = jakartaPeriod(issuedAt)

  /**
   * Nomor dan barisnya lahir di SATU transaksi.
   *
   * Kalau penghitung dinaikkan lebih dulu di transaksinya sendiri, setiap insert
   * yang gagal sesudahnya meninggalkan lubang permanen di urutan — dan urutan
   * yang bolong adalah hal pertama yang membuat orang meragukan pembukuannya.
   *
   * Batas waktunya dinaikkan dari bawaan 5 detik: kolam koneksi Prisma di sini
   * hanya 3 (lihat `lib/prisma/client.ts`), jadi penerbitan yang bersamaan
   * memang mengantre — mengantre bukan kegagalan.
   */
  const quote = await prisma.$transaction(
    async (tx) => {
      const sequence = await nextQuoteSequence(tx, period)

      const created = await tx.pcBuildQuote.create({
        data: {
          items,
          subtotal,
          // Jasa rakit sekarang jadi step biasa di PC Builder, jadi nilainya sudah
          // ikut di `subtotal`. Kolomnya dipertahankan untuk membaca quotation lama
          // yang biayanya masih terpisah.
          assemblyFee: 0,
          total: subtotal,
          itemCount: items.length,
          code: buildQuoteCode(issuedAt, sequence),
          contentHash,
          period,
          sequence,
          createdAt: issuedAt,
          ...(owner
            ? {
                customerName: owner.customerName,
                customerPhone: owner.customerPhone,
                internalNote: owner.internalNote,
                ownerUserId: owner.ownerUserId,
                salesName: owner.salesName,
                createdByUserId: owner.createdByUserId,
                /**
                 * Operan yang TIDAK terjadi ditandai terbaca saat itu juga.
                 * Tanpa ini, quotation yang diterbitkan sales untuk dirinya
                 * sendiri ikut memicu toast "dapat operan dari CS" — notifikasi
                 * atas peristiwa yang tidak pernah ada.
                 */
                handoverSeenAt:
                  owner.createdByUserId === owner.ownerUserId ? issuedAt : null,
              }
            : {}),
        },
        select: { id: true, code: true },
      })

      // Rev. 1 ditulis sekarang juga, bukan nanti saat revisi pertama terjadi.
      // Riwayat yang dimulai dari Rev. 2 memaksa pembacanya menebak isi versi
      // pertama dari baris induk yang sudah tertimpa.
      await tx.pcBuildQuoteRevision.create({
        data: {
          quoteId: created.id,
          revision: 1,
          items,
          subtotal,
          assemblyFee: 0,
          total: subtotal,
          itemCount: items.length,
          usedLatestPrices: true,
          createdByUserId: owner?.createdByUserId ?? null,
          createdAt: issuedAt,
        },
      })

      return created
    },
    { timeout: 15_000, maxWait: 15_000 }
  )

  return { code: quote.code }
}

/** Satu komponen yang dipilih di builder. Hanya id & kuantitas — TIDAK ada harga. */
export type QuotationSelection = {
  stepId: string | null
  productId: number
  quantity: number
}

export type IssueQuotationResult =
  | { ok: true; code: string }
  | { ok: false; error: string }

/**
 * Terbitkan quotation dari pilihan komponen — jalur tunggal untuk tombol Print.
 *
 * Klien hanya mengirim `stepId`, `productId`, dan `quantity`. **Harga tidak
 * pernah datang dari klien** (CLAUDE.md §2.7): ia dibaca ulang dari katalog di
 * sini, lewat `priceCartFromCatalog` — fungsi yang sama yang dipakai checkout
 * dan Konsultasi WA, sehingga harga di PDF, di keranjang, dan di pesan CS
 * mustahil berbeda.
 *
 * Memakai `priceCartFromCatalog` sekaligus menutup dua celah yang dulu ada di
 * halaman cetak, yang membaca produk dengan kueri sendiri:
 *  - halaman itu TIDAK menyaring `status: PUBLISHED`, jadi komponen yang sudah
 *    ditarik staf dari etalase tetap bisa masuk quotation oleh siapa pun yang
 *    menyimpan id-nya;
 *  - ia TIDAK memeriksa `saleEndDate`, jadi harga obral yang sudah kedaluwarsa
 *    ikut tercetak — dan dokumen itulah yang dibawa pelanggan ke kasir.
 */
export async function issueQuotation(
  selections: QuotationSelection[],
  owner?: QuotationOwner
): Promise<IssueQuotationResult> {
  if (selections.length === 0) {
    return { ok: false, error: "Belum ada komponen yang dipilih." }
  }

  const { priceCartFromCatalog } = await import("@/lib/api/woocommerce/cart-pricing")
  const { getPcBuilderConfig } = await import("@/lib/pc-builder/config")

  const [priced, stepsConfig] = await Promise.all([
    priceCartFromCatalog(
      selections.map((s) => ({ productId: s.productId, quantity: s.quantity })),
      "id"
    ),
    getPcBuilderConfig(),
  ])

  /**
   * Komponen yang hilang dari katalog MEMBATALKAN penerbitan, tidak dibuang
   * diam-diam. Quotation yang terbit tanpa satu komponennya adalah penawaran
   * atas rakitan yang tidak pernah dipilih siapa pun — dan yang menemukannya
   * adalah kasir, di depan pelanggan.
   */
  if (priced.unavailableProductIds.length > 0) {
    return {
      ok: false,
      error:
        priced.unavailableProductIds.length === 1
          ? "Satu komponen sudah tidak tersedia di katalog. Ganti komponen itu lalu coba lagi."
          : `${priced.unavailableProductIds.length} komponen sudah tidak tersedia di katalog. Ganti komponen itu lalu coba lagi.`,
    }
  }

  if (priced.lines.length === 0) {
    return { ok: false, error: "Komponen yang dipilih tidak ditemukan di katalog." }
  }

  // Gambar dibaca terpisah: `priceCartFromCatalog` sengaja tidak mengembalikannya
  // karena checkout tidak membutuhkannya, dan melebarkan tipe bersama demi satu
  // pemanggil berarti setiap jalur pemesanan ikut menanggung kolom yang tak
  // dipakainya. Satu kueri tambahan pada aksi yang eksplisit — bukan pada setiap
  // render halaman — adalah harga yang wajar.
  const currentInfo = await getQuoteProductsCurrentInfo(priced.lines.map((l) => l.productId))

  const stepNameById = new Map(stepsConfig.map((step) => [step.id, step.name]))
  const stepIdByProduct = new Map(selections.map((s) => [s.productId, s.stepId]))

  const items: QuoteLineItem[] = priced.lines.map((line) => {
    const stepId = stepIdByProduct.get(line.productId) ?? null
    return {
      productId: line.productId,
      // Nama induk yang dicetak, bukan nama baris varian — varian warisan impor
      // WooCommerce sering mengulang nama induknya utuh, jadi yang membedakan
      // adalah `variationLabel`. Lihat lib/utils/variation.ts.
      name: line.parentName ?? line.name,
      parentName: line.parentName,
      variationLabel: line.variationLabel,
      sku: line.sku || null,
      image: currentInfo.get(line.productId)?.image ?? undefined,
      price: line.unitPrice,
      quantity: line.quantity,
      stepName: stepId ? stepNameById.get(stepId) ?? null : null,
    }
  })

  try {
    const { code } = await recordPcBuildQuote(items, owner)
    return { ok: true, code }
  } catch (error) {
    console.error("[quotation] gagal menerbitkan:", error)
    return { ok: false, error: "Gagal menerbitkan quotation. Coba lagi sebentar lagi." }
  }
}

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
  /** "terbit" | "closing" — dipakai badge di grid & hasil pencarian. */
  status: string
  /** Nama pelanggan, kalau quotation diterbitkan staff atas nama seseorang. */
  customerName: string | null
  salesName: string | null
  revision: number
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
  status: true,
  customerName: true,
  salesName: true,
  revision: true,
} as const

function toQuoteSummary(row: {
  code: string
  total: { toString(): string }
  itemCount: number
  createdAt: Date
  updatedAt: Date
  status: string
  customerName: string | null
  salesName: string | null
  revision: number
}): QuoteSummary {
  return {
    code: row.code,
    total: Number(row.total),
    itemCount: row.itemCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status,
    customerName: row.customerName,
    salesName: row.salesName,
    revision: row.revision,
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

/** Satu baris riwayat quotation di `/profile/quotation`. */
export type QuotationHistoryRow = {
  code: string
  customerName: string | null
  customerPhone: string | null
  salesName: string | null
  total: number
  itemCount: number
  revision: number
  status: string
  createdAt: string
  closedAt: string | null
  /** Diterbitkan CS lalu dioper ke pemiliknya — `createdByUserId != ownerUserId`. */
  dioperDariCs: boolean
  /** Nama yang mengoper, untuk badge "Dioper dari CS · <nama>". */
  dioperOleh: string | null
}

const HISTORY_SELECT = {
  code: true,
  customerName: true,
  customerPhone: true,
  salesName: true,
  total: true,
  itemCount: true,
  revision: true,
  status: true,
  createdAt: true,
  closedAt: true,
  ownerUserId: true,
  createdByUserId: true,
  createdBy: { select: { name: true, salesDisplayName: true } },
} as const

function toHistoryRow(row: {
  code: string
  customerName: string | null
  customerPhone: string | null
  salesName: string | null
  total: { toString(): string }
  itemCount: number
  revision: number
  status: string
  createdAt: Date
  closedAt: Date | null
  ownerUserId: string | null
  createdByUserId: string | null
  createdBy: { name: string; salesDisplayName: string | null } | null
}): QuotationHistoryRow {
  const dioper = row.createdByUserId !== null && row.createdByUserId !== row.ownerUserId
  return {
    code: row.code,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    salesName: row.salesName,
    total: Number(row.total),
    itemCount: row.itemCount,
    revision: row.revision,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    dioperDariCs: dioper,
    dioperOleh: dioper ? (row.createdBy?.salesDisplayName ?? row.createdBy?.name ?? null) : null,
  }
}

/**
 * Riwayat quotation seseorang.
 *
 * `peran` memisahkan dua pertanyaan yang tampak mirip tapi berbeda:
 *  - `"milik"`   — yang ia PEGANG (`ownerUserId`). Ini yang boleh ia revisi.
 *  - `"dioper"`  — yang ia TERBITKAN lalu oper ke orang lain. Baca-saja; hak
 *                  revisinya sudah berpindah bersama kepemilikannya.
 *
 * Pencarian menyentuh kode, nama pelanggan, dan nomor HP. `contains` berarti
 * `LIKE '%…%'` yang tidak memakai indeks — diterima dengan sadar karena
 * daftarnya sudah disaring pemilik lebih dulu, jadi yang dipindai adalah
 * quotation satu orang, bukan seluruh tabel.
 */
export async function listQuotationsForUser(
  userId: string,
  opts: { peran?: "milik" | "dioper"; q?: string; take?: number } = {}
): Promise<QuotationHistoryRow[]> {
  const { peran = "milik", q, take = 50 } = opts
  const term = q?.trim() ?? ""

  const rows = await getPrisma().pcBuildQuote.findMany({
    where: {
      ...(peran === "milik"
        ? { ownerUserId: userId }
        : // Yang ia terbitkan TAPI bukan miliknya — kalau tidak, quotation yang
          // ia pegang sendiri akan muncul di dua tab sekaligus.
          { createdByUserId: userId, NOT: { ownerUserId: userId } }),
      ...(term.length >= 3
        ? {
            OR: [
              { code: { contains: term.toUpperCase() } },
              { customerName: { contains: term } },
              { customerPhone: { contains: term } },
            ],
          }
        : {}),
    },
    select: HISTORY_SELECT,
    orderBy: { createdAt: "desc" },
    take,
  })

  return rows.map(toHistoryRow)
}

/**
 * Rekap penjualan satu sales dalam satu periode.
 *
 * Dihitung dari `closedAt`, **bukan** tanggal terbit: quotation yang terbit
 * Agustus lalu deal September adalah penjualan September. Memakai tanggal
 * terbit akan memindahkan capaian seseorang ke bulan yang salah setiap kali
 * penawaran butuh waktu — yang justru paling sering terjadi pada rakitan mahal.
 */
export async function summarizeSalesMonth(
  userId: string,
  period: string
): Promise<{ unit: number; total: number }> {
  const { mulai, sesudah } = jakartaMonthRange(period)

  const hasil = await getPrisma().pcBuildQuote.aggregate({
    where: {
      ownerUserId: userId,
      status: "closing",
      closedAt: { gte: mulai, lt: sesudah },
    },
    _count: { _all: true },
    _sum: { total: true },
  })

  return { unit: hasil._count._all, total: Number(hasil._sum.total ?? 0) }
}

/**
 * Detail satu quotation untuk pemiliknya (atau yang mengopernya).
 *
 * `null` kalau kodenya tidak ada ATAU bukan miliknya — sengaja tidak dibedakan.
 * Membedakan "tidak ada" dari "bukan milik Anda" mengubah halaman ini menjadi
 * alat untuk menebak kode quotation orang lain.
 */
export async function getQuotationForUser(code: string, userId: string) {
  const quote = await getPrisma().pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      ...HISTORY_SELECT,
      id: true,
      items: true,
      subtotal: true,
      internalNote: true,
      owner: { select: { name: true, salesDisplayName: true } },
      revisions: {
        select: {
          revision: true,
          total: true,
          itemCount: true,
          usedLatestPrices: true,
          createdAt: true,
        },
        orderBy: { revision: "desc" },
      },
      statusLogs: {
        select: { fromStatus: true, toStatus: true, reason: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!quote) return null
  if (quote.ownerUserId !== userId && quote.createdByUserId !== userId) return null

  return {
    ...toHistoryRow(quote),
    isOwner: quote.ownerUserId === userId,
    internalNote: quote.internalNote,
    subtotal: Number(quote.subtotal),
    items: Array.isArray(quote.items) ? (quote.items as unknown as QuoteLineItem[]) : [],
    revisions: quote.revisions.map((r) => ({
      revision: r.revision,
      total: Number(r.total),
      itemCount: r.itemCount,
      usedLatestPrices: r.usedLatestPrices,
      createdAt: r.createdAt.toISOString(),
    })),
    statusLogs: quote.statusLogs.map((l) => ({
      fromStatus: l.fromStatus,
      toStatus: l.toStatus,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    })),
  }
}

/** Satu baris revisi terakhir, untuk dimuat ulang ke builder. */
export type RevisionSeedItem = {
  productId: number
  quantity: number
  stepName: string | null
  /** Harga satuan pada revisi terakhir — yang akan dipertahankan secara bawaan. */
  price: number
}

export type RevisionSeed = {
  code: string
  /** Revisi yang BERLAKU sekarang. Yang akan ditulis adalah `revision + 1`. */
  revision: number
  customerName: string | null
  customerPhone: string | null
  internalNote: string | null
  items: RevisionSeedItem[]
}

/**
 * Muat quotation untuk direvisi — `null` kalau tidak boleh.
 *
 * Tiga syarat, dan ketiganya diperiksa DI SINI supaya jalur mana pun yang
 * memanggilnya menanggung aturan yang sama:
 *  1. kodenya ada;
 *  2. `userId` adalah PEMILIKNYA (`ownerUserId`) — bukan sekadar yang
 *     menerbitkannya. CS yang sudah mengoper kehilangan hak revisi bersama
 *     kepemilikannya;
 *  3. statusnya masih `terbit`. Quotation yang sudah ditandai terjual terkunci:
 *     merevisinya berarti mengubah isi dokumen yang sudah dipakai bertransaksi.
 *
 * Ketiganya berakhir `null` tanpa dibedakan — membedakannya mengubah halaman
 * ini jadi alat untuk menebak kode quotation orang lain.
 */
export async function getQuotationForRevision(
  code: string,
  userId: string
): Promise<RevisionSeed | null> {
  const quote = await getPrisma().pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      code: true,
      revision: true,
      status: true,
      ownerUserId: true,
      customerName: true,
      customerPhone: true,
      internalNote: true,
      revisions: {
        select: { items: true },
        orderBy: { revision: "desc" },
        take: 1,
      },
    },
  })

  if (!quote) return null
  if (quote.ownerUserId !== userId) return null
  if (quote.status !== "terbit") return null

  const snapshot = quote.revisions[0]?.items
  const items = Array.isArray(snapshot) ? (snapshot as unknown as QuoteLineItem[]) : []
  if (items.length === 0) return null

  return {
    code: quote.code,
    revision: quote.revision,
    customerName: quote.customerName,
    customerPhone: quote.customerPhone,
    internalNote: quote.internalNote,
    items: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      stepName: item.stepName ?? null,
      price: item.price,
    })),
  }
}

export type ReviseQuotationInput = {
  selections: QuotationSelection[]
  customerName: string
  customerPhone: string | null
  internalNote: string | null
  /**
   * `false` (bawaan) — harga revisi sebelumnya DIPERTAHANKAN untuk komponen yang
   * sudah ada di sana. `true` — seluruh baris memakai harga katalog hari ini.
   *
   * Klien mengirim BOOLEAN, tidak pernah angka rupiah (CLAUDE.md §2.7).
   */
  useLatestPrices: boolean
}

/** Penanda internal bahwa revisi kalah balapan; diterjemahkan jadi pesan pengguna. */
class RevisiBentrokError extends Error {}

/**
 * Tulis revisi baru atas quotation yang sudah ada. **Kodenya tidak berubah.**
 *
 * Aturan harganya — dan ini inti fitur revisi:
 *
 *  - Komponen yang SUDAH ADA di revisi sebelumnya mempertahankan harganya,
 *    kecuali `useLatestPrices`. Pelanggan sudah memegang kertas dengan angka
 *    itu; menaikkannya diam-diam saat sales cuma menambah satu keping RAM
 *    adalah cara tercepat kehilangan kepercayaannya.
 *  - Komponen yang BARU ditambahkan selalu memakai harga katalog. Tidak ada
 *    harga lama untuk barang yang belum pernah ditawarkan.
 *
 * Yang tidak berubah dari penerbitan: harga tidak pernah datang dari klien, dan
 * komponen yang hilang dari katalog membatalkan penyimpanan alih-alih dibuang
 * diam-diam.
 */
export async function reviseQuotation(
  code: string,
  userId: string,
  input: ReviseQuotationInput
): Promise<IssueQuotationResult> {
  const seed = await getQuotationForRevision(code, userId)
  if (!seed) {
    return {
      ok: false,
      error:
        "Quotation ini tidak bisa direvisi — mungkin sudah ditandai terjual, atau bukan milik Anda.",
    }
  }

  if (input.selections.length === 0) {
    return { ok: false, error: "Rakitan tidak boleh kosong." }
  }

  const { priceCartFromCatalog } = await import("@/lib/api/woocommerce/cart-pricing")
  const { getPcBuilderConfig } = await import("@/lib/pc-builder/config")

  const [priced, stepsConfig] = await Promise.all([
    priceCartFromCatalog(
      input.selections.map((s) => ({ productId: s.productId, quantity: s.quantity })),
      "id"
    ),
    getPcBuilderConfig(),
  ])

  if (priced.unavailableProductIds.length > 0) {
    return {
      ok: false,
      error:
        priced.unavailableProductIds.length === 1
          ? "Satu komponen sudah tidak tersedia di katalog. Ganti atau hapus komponen itu lalu simpan lagi."
          : `${priced.unavailableProductIds.length} komponen sudah tidak tersedia di katalog. Ganti atau hapus komponen itu lalu simpan lagi.`,
    }
  }
  if (priced.lines.length === 0) {
    return { ok: false, error: "Komponen yang dipilih tidak ditemukan di katalog." }
  }

  const hargaSebelumnya = new Map(seed.items.map((item) => [item.productId, item.price]))
  const currentInfo = await getQuoteProductsCurrentInfo(priced.lines.map((l) => l.productId))
  const stepNameById = new Map(stepsConfig.map((step) => [step.id, step.name]))
  const stepIdByProduct = new Map(input.selections.map((s) => [s.productId, s.stepId]))

  const items: QuoteLineItem[] = priced.lines.map((line) => {
    const lama = hargaSebelumnya.get(line.productId)
    const price = !input.useLatestPrices && lama !== undefined ? lama : line.unitPrice
    const stepId = stepIdByProduct.get(line.productId) ?? null

    return {
      productId: line.productId,
      name: line.parentName ?? line.name,
      parentName: line.parentName,
      variationLabel: line.variationLabel,
      sku: line.sku || null,
      image: currentInfo.get(line.productId)?.image ?? undefined,
      price,
      quantity: line.quantity,
      stepName: stepId ? stepNameById.get(stepId) ?? null : null,
    }
  })

  const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0)
  const revisiBaru = seed.revision + 1
  const now = new Date()

  try {
    await getPrisma().$transaction(
      async (tx) => {
        /**
         * Syarat `status` dan `revision` ikut di WHERE, bukan cuma diperiksa
         * lebih dulu lewat `getQuotationForRevision`. Di antara pemeriksaan itu
         * dan baris ini, kasir bisa menandai quotation terjual, atau sales
         * membuka dua tab lalu menyimpan dua revisi bersamaan. Dengan syaratnya
         * di dalam UPDATE, yang kalah menyentuh nol baris dan tahu ia kalah.
         */
        const { count } = await tx.pcBuildQuote.updateMany({
          where: { code: seed.code, status: "terbit", revision: seed.revision },
          data: {
            revision: revisiBaru,
            items,
            subtotal,
            assemblyFee: 0,
            total: subtotal,
            itemCount: items.length,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            internalNote: input.internalNote,
            contentHash: computeContentHash(items),
            updatedAt: now,
          },
        })
        if (count === 0) throw new RevisiBentrokError()

        const quote = await tx.pcBuildQuote.findUnique({
          where: { code: seed.code },
          select: { id: true },
        })
        if (!quote) throw new RevisiBentrokError()

        await tx.pcBuildQuoteRevision.create({
          data: {
            quoteId: quote.id,
            revision: revisiBaru,
            items,
            subtotal,
            assemblyFee: 0,
            total: subtotal,
            itemCount: items.length,
            usedLatestPrices: input.useLatestPrices,
            createdByUserId: userId,
            createdAt: now,
          },
        })
      },
      { timeout: 15_000, maxWait: 15_000 }
    )
  } catch (error) {
    if (error instanceof RevisiBentrokError) {
      return {
        ok: false,
        error:
          "Quotation ini baru saja berubah — mungkin sudah direvisi di tab lain atau ditandai terjual. Muat ulang halaman.",
      }
    }
    console.error("[quotation] gagal menyimpan revisi:", error)
    return { ok: false, error: "Gagal menyimpan revisi. Coba lagi sebentar lagi." }
  }

  return { ok: true, code: seed.code }
}

export type StatusChangeResult = { ok: true } | { ok: false; error: string }

/**
 * Tandai quotation TERJUAL. Dipanggil kasir dari `/verify/[code]`.
 *
 * `expectedRevision` bukan hiasan. Antara kasir membuka halaman dan menekan
 * tombol, sales bisa menyimpan revisi baru — dan kasir akan menutup penjualan
 * atas angka yang sudah bukan angka terakhir. Dengan nomor revisi ikut di WHERE,
 * yang kalah menyentuh nol baris dan diberi tahu, bukan diam-diam menang.
 *
 * `status: "terbit"` juga ikut di WHERE supaya menekan tombol dua kali (atau
 * dua kasir di dua layar) tidak menimpa `closedAt` yang sudah tercatat.
 */
export async function markQuotationClosed(
  code: string,
  expectedRevision: number,
  byUserId: string
): Promise<StatusChangeResult> {
  const prisma = getPrisma()
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.pcBuildQuote.updateMany({
        where: { code: code.toUpperCase(), status: "terbit", revision: expectedRevision },
        data: { status: "closing", closedAt: now, closedByUserId: byUserId },
      })
      if (count === 0) throw new StatusBentrokError()

      const quote = await tx.pcBuildQuote.findUnique({
        where: { code: code.toUpperCase() },
        select: { id: true },
      })
      if (!quote) throw new StatusBentrokError()

      await tx.pcBuildQuoteStatusLog.create({
        data: {
          quoteId: quote.id,
          fromStatus: "terbit",
          toStatus: "closing",
          byUserId,
          createdAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof StatusBentrokError) {
      return {
        ok: false,
        error:
          "Quotation ini sudah ditandai terjual, atau baru saja direvisi. Muat ulang halaman lalu periksa lagi.",
      }
    }
    console.error("[quotation] gagal menandai closing:", error)
    return { ok: false, error: "Gagal menandai quotation. Coba lagi sebentar lagi." }
  }

  return { ok: true }
}

/**
 * Batalkan status terjual. Hanya admin, dan hanya dengan alasan.
 *
 * Alasannya WAJIB dan itu disengaja. Tindakan ini mengurangi angka penjualan
 * seorang sales pada bulan berjalan; tanpa alasan tertulis, satu-satunya jejak
 * yang tersisa adalah bahwa angkanya pernah lebih besar — dan tidak ada cara
 * menjawab kenapa, sebulan kemudian.
 *
 * `closedAt`/`closedByUserId` dikosongkan supaya rekap bulanan (yang menghitung
 * dari `closedAt`) langsung ikut benar. Jejaknya tidak hilang: ia pindah ke
 * `pc_build_quote_status_logs`, tempat yang memang untuk itu.
 */
export async function reopenQuotation(
  code: string,
  byUserId: string,
  reason: string
): Promise<StatusChangeResult> {
  const prisma = getPrisma()
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.pcBuildQuote.updateMany({
        where: { code: code.toUpperCase(), status: "closing" },
        data: { status: "terbit", closedAt: null, closedByUserId: null },
      })
      if (count === 0) throw new StatusBentrokError()

      const quote = await tx.pcBuildQuote.findUnique({
        where: { code: code.toUpperCase() },
        select: { id: true },
      })
      if (!quote) throw new StatusBentrokError()

      await tx.pcBuildQuoteStatusLog.create({
        data: {
          quoteId: quote.id,
          fromStatus: "closing",
          toStatus: "terbit",
          byUserId,
          reason: reason.slice(0, 255),
          createdAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof StatusBentrokError) {
      return { ok: false, error: "Quotation ini sudah tidak berstatus terjual. Muat ulang halaman." }
    }
    console.error("[quotation] gagal membatalkan closing:", error)
    return { ok: false, error: "Gagal membatalkan status. Coba lagi sebentar lagi." }
  }

  return { ok: true }
}

/** Penanda internal bahwa perubahan status kalah balapan. */
class StatusBentrokError extends Error {}

/**
 * Isi `/verify/[code]` yang MELEBIHI `getQuoteByCode`: status, identitas yang
 * boleh dilihat kasir, dan riwayat revisinya.
 *
 * **Nomor HP dan catatan internal SENGAJA tidak ada di sini.** Kasir cukup
 * mencocokkan nama orang yang berdiri di depan meja dengan dokumennya;
 * nomor HP tidak menambah apa pun pada pekerjaan itu, dan catatan internal
 * ("masih banding harga") adalah percakapan tim yang tidak seharusnya terbaca
 * dari layar yang menghadap pelanggan. Keduanya ada di `/profile/quotation`
 * untuk pemiliknya dan di `/admin/quotation` untuk admin.
 *
 * Jangan menambahkannya ke `select` di bawah "supaya lengkap".
 */
export async function getQuoteStatusForCashier(code: string) {
  return getPrisma().pcBuildQuote.findUnique({
    where: { code: code.toUpperCase() },
    select: {
      status: true,
      revision: true,
      customerName: true,
      salesName: true,
      closedAt: true,
      revisions: {
        select: { revision: true, total: true, itemCount: true, usedLatestPrices: true, createdAt: true },
        orderBy: { revision: "desc" },
      },
    },
  })
}

/** Satu baris di tabel pengawasan `/admin/quotation`. */
export type AdminQuotationRow = QuotationHistoryRow & {
  /** Nama akun pemilik, untuk quotation yang pemiliknya bukan Sales (CS). */
  ownerName: string | null
  internalNote: string | null
}

export type AdminQuotationFilter = {
  q?: string
  /** "YYYYMM" — disaring menurut TANGGAL TERBIT, bukan tanggal closing. */
  periode?: string
  ownerUserId?: string
  status?: string
  /** Halaman, mulai dari 1. */
  page?: number
}

/**
 * Baris per halaman di `/admin/quotation`.
 *
 * Menggantikan `take = 100` yang dulu dipakai tanpa pagination. Batas itu
 * BUKAN pengaman melainkan pemotong senyap: begitu quotation ke-101 terbit,
 * yang paling lama hilang dari daftar tanpa satu pun tanda di layar — dan
 * halaman ini justru tempat orang mencari quotation lama saat ada keluhan.
 */
export const ADMIN_QUOTATION_PAGE_SIZE = 25

export type AdminQuotationListResult = {
  rows: AdminQuotationRow[]
  total: number
  page: number
  pageCount: number
}

/**
 * Seluruh quotation lintas sales — hanya untuk `/admin/quotation`.
 *
 * Berbeda dari `listQuotationsForUser`, fungsi ini TIDAK menyaring pemilik.
 * Itulah sebabnya ia berdiri sendiri alih-alih menambah parameter opsional ke
 * fungsi itu: saringan pemilik yang bisa dimatikan lewat argumen adalah
 * saringan yang cepat atau lambat akan dimatikan di tempat yang salah.
 *
 * Penyaringan periode memakai `createdAt` (tanggal terbit), bukan `closedAt`.
 * Ini daftar dokumen, bukan rekap penjualan — yang menghitung capaian adalah
 * `summarizeSalesByMonth` di bawah, dan ia memang memakai `closedAt`.
 */
export async function listQuotationsForAdmin(
  filter: AdminQuotationFilter = {}
): Promise<AdminQuotationListResult> {
  const { q, periode, ownerUserId, status } = filter
  const page = Math.max(1, filter.page ?? 1)
  const term = q?.trim() ?? ""
  const rentang = periode && /^\d{6}$/.test(periode) ? jakartaMonthRange(periode) : null

  const where = {
    ...(rentang ? { createdAt: { gte: rentang.mulai, lt: rentang.sesudah } } : {}),
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(status === "terbit" || status === "closing" ? { status } : {}),
    ...(term.length >= 3
      ? {
          OR: [
            { code: { contains: term.toUpperCase() } },
            { customerName: { contains: term } },
            { customerPhone: { contains: term } },
          ],
        }
      : {}),
  }

  const prisma = getPrisma()
  const [total, rows] = await Promise.all([
    prisma.pcBuildQuote.count({ where }),
    prisma.pcBuildQuote.findMany({
      where,
      select: {
        ...HISTORY_SELECT,
        internalNote: true,
        owner: { select: { name: true, salesDisplayName: true } },
      },
      /**
       * `code` sebagai kunci kedua, bukan `createdAt` saja.
       *
       * Quotation yang terbit pada detik yang sama — yang terjadi saat sales
       * menerbitkan beberapa revisi berurutan — bisa tersusun berbeda tiap
       * query. Pada daftar berhalaman itu berarti satu baris muncul di dua
       * halaman sementara baris lain tidak pernah muncul sama sekali, dan yang
       * tidak pernah muncul itulah yang sedang dicari orang.
       */
      orderBy: [{ createdAt: "desc" }, { code: "desc" }],
      skip: (page - 1) * ADMIN_QUOTATION_PAGE_SIZE,
      take: ADMIN_QUOTATION_PAGE_SIZE,
    }),
  ])

  return {
    rows: rows.map((row) => ({
      ...toHistoryRow(row),
      ownerName: row.owner ? (row.owner.salesDisplayName ?? row.owner.name) : null,
      internalNote: row.internalNote,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_QUOTATION_PAGE_SIZE)),
  }
}

/**
 * Rekap penjualan SEMUA pemilik dalam satu periode, diurutkan dari yang
 * terbesar.
 *
 * Dihitung dari `closedAt` — sama dengan rekap di profil masing-masing sales,
 * supaya angka yang dilihat owner dan angka yang dilihat sales tidak pernah
 * berbeda. Kalau keduanya dihitung dengan aturan yang berlainan, percakapan
 * yang menyusul bukan tentang penjualan melainkan tentang laporan mana yang
 * benar.
 */
export async function summarizeSalesByMonth(
  periode: string
): Promise<{ ownerUserId: string; nama: string; unit: number; total: number }[]> {
  const { mulai, sesudah } = jakartaMonthRange(periode)

  const grup = await getPrisma().pcBuildQuote.groupBy({
    by: ["ownerUserId"],
    where: {
      status: "closing",
      closedAt: { gte: mulai, lt: sesudah },
      ownerUserId: { not: null },
    },
    _count: { _all: true },
    _sum: { total: true },
  })

  if (grup.length === 0) return []

  const ids = grup.map((g) => g.ownerUserId!).filter(Boolean)
  const users = await getPrisma().user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, salesDisplayName: true },
  })
  const namaById = new Map(users.map((u) => [u.id, u.salesDisplayName ?? u.name]))

  return grup
    .map((g) => ({
      ownerUserId: g.ownerUserId!,
      // Pemilik yang akunnya sudah dihapus tetap dihitung — penjualannya
      // terjadi, dan menghilangkannya dari rekap membuat total bulan itu tidak
      // cocok dengan jumlah dokumennya.
      nama: namaById.get(g.ownerUserId!) ?? "(akun dihapus)",
      unit: g._count._all,
      total: Number(g._sum.total ?? 0),
    }))
    .sort((a, b) => b.total - a.total)
}

/** Daftar pemilik quotation, untuk saringan di `/admin/quotation`. */
export async function listQuotationOwners(): Promise<{ id: string; nama: string }[]> {
  const grup = await getPrisma().pcBuildQuote.groupBy({
    by: ["ownerUserId"],
    where: { ownerUserId: { not: null } },
  })
  const ids = grup.map((g) => g.ownerUserId!).filter(Boolean)
  if (ids.length === 0) return []

  const users = await getPrisma().user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, salesDisplayName: true },
    orderBy: { name: "asc" },
  })
  return users.map((u) => ({ id: u.id, nama: u.salesDisplayName ?? u.name }))
}

/** Satu operan yang belum dibaca sales penerima. */
export type UnseenHandover = {
  code: string
  customerName: string | null
  /** Nama CS yang mengoper. */
  dariCs: string | null
  total: number
  createdAt: string
}

/**
 * Operan dari CS yang belum dibaca oleh `userId`.
 *
 * "Operan" berarti `createdByUserId != ownerUserId` — quotation yang
 * diterbitkan orang lain lalu diserahkan. Quotation yang diterbitkan sales
 * untuk dirinya sendiri tidak pernah masuk ke sini, karena `handoverSeenAt`-nya
 * sudah diisi saat terbit.
 *
 * Dibatasi 5: ini notifikasi, bukan daftar kerja. Sales yang punya dua puluh
 * operan belum dibaca lebih terbantu oleh halaman riwayatnya daripada oleh dua
 * puluh toast yang harus ditutup satu per satu.
 */
export async function listUnseenHandovers(userId: string): Promise<UnseenHandover[]> {
  const rows = await getPrisma().pcBuildQuote.findMany({
    where: {
      ownerUserId: userId,
      handoverSeenAt: null,
      createdByUserId: { not: null, notIn: [userId] },
    },
    select: {
      code: true,
      customerName: true,
      total: true,
      createdAt: true,
      createdBy: { select: { name: true, salesDisplayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  })

  return rows.map((row) => ({
    code: row.code,
    customerName: row.customerName,
    dariCs: row.createdBy ? (row.createdBy.salesDisplayName ?? row.createdBy.name) : null,
    total: Number(row.total),
    createdAt: row.createdAt.toISOString(),
  }))
}

/**
 * Tandai satu operan sudah dibaca. Dipanggil saat sales menutup toast-nya.
 *
 * `ownerUserId` ikut di WHERE: menandai terbaca hanya boleh dilakukan oleh
 * penerimanya, dan syarat yang hidup di dalam kueri tidak bisa dilewati jalur
 * lain yang ditambahkan kemudian.
 *
 * Disimpan di SERVER, bukan di localStorage. Operan yang datang saat sales
 * belum login harus tetap sampai ketika ia login, dan yang sudah ditutup tidak
 * boleh muncul lagi hanya karena ia membuka perangkat lain.
 */
export async function markHandoverSeen(code: string, userId: string): Promise<boolean> {
  const { count } = await getPrisma().pcBuildQuote.updateMany({
    where: { code: code.toUpperCase(), ownerUserId: userId, handoverSeenAt: null },
    data: { handoverSeenAt: new Date() },
  })
  return count > 0
}
