import type { ProductInput } from "@/types/woocommerce"

/**
 * Satu-satunya tempat yang memutuskan bentuk baris `product_logs`.
 *
 * Sebelumnya logika ini ditulis dua kali — sekali di route handler produk,
 * sekali di server action harga cepat — dan keduanya sempat berbeda: jalur
 * harga cepat menulis `fieldAffected: "price"` dengan nilai berformat
 * `"Regular: 100, Sale: 0"`, sementara jalur form menulis `"regular_price"`
 * dengan angka mentah. Akibatnya satu perubahan yang sama tampil dengan dua
 * nama field di halaman log dan penyaringnya tidak bisa dipercaya. Semua
 * penulis log sekarang lewat berkas ini supaya nama field dan format nilainya
 * tidak bisa lagi menyimpang.
 */

/** Nama field harga — dipakai untuk memisahkan log harga dari log lainnya. */
export const PRICE_FIELDS = new Set(["regular_price", "sale_price"])

export type ProductChange = {
  field: string
  old: unknown
  new: unknown
}

/**
 * Baris log siap tulis. Sengaja tidak memuat `userName`/`productId` — itu
 * urusan pemanggil, yang tahu siapa yang sedang masuk.
 */
export type ProductLogEntry = {
  action: string
  fieldAffected: string
  oldValue: string
  newValue: string
}

/**
 * Bentuk produk yang tersimpan di database lokal, dipersempit ke kolom yang
 * ikut dibandingkan. Dipakai sebagai parameter supaya helper ini tidak
 * bergantung pada tipe Prisma yang jauh lebih lebar.
 */
export type ProductSnapshot = {
  name: string
  status: string
  shortDescription: string | null
  description: string | null
  regularPrice: { toString(): string } | null
  salePrice: { toString(): string } | null
  stockStatus: string | null
  stockQty: number | null
  categories: Array<{ categoryId: number }>
  images: Array<{ url: string }>
}

/**
 * Status di database disimpan sebagai enum huruf besar, sementara payload
 * WooCommerce memakai huruf kecil. Tanpa pemetaan ini setiap penyimpanan
 * tercatat sebagai perubahan status walau tidak ada yang berubah.
 */
const STOCK_STATUS_MAP: Record<string, string> = {
  INSTOCK: "instock",
  OUTOFSTOCK: "outofstock",
  ONBACKORDER: "onbackorder",
}

const STATUS_MAP: Record<string, string> = {
  PUBLISHED: "publish",
  DRAFT: "draft",
  PRIVATE: "private",
}

/**
 * Deskripsi produk bisa sepanjang ribuan karakter. Menyimpannya utuh di kolom
 * log membuat tabel membengkak tanpa memberi informasi yang benar-benar
 * dibaca, jadi yang dicatat hanya fakta bahwa teksnya berubah.
 */
const LONG_TEXT_OLD = "[Teks Panjang]"
const LONG_TEXT_NEW = "[Teks Panjang Diubah]"

/**
 * Membandingkan produk tersimpan dengan payload yang baru dikirim.
 *
 * Hanya field yang benar-benar ada di `input` yang diperiksa: quick edit
 * mengirim sebagian field saja, dan field yang tidak dikirim bukan berarti
 * dikosongkan.
 */
export function diffProductChanges(
  existing: ProductSnapshot,
  input: Partial<ProductInput>
): ProductChange[] {
  const changes: ProductChange[] = []

  if (input.name !== undefined && existing.name !== input.name) {
    changes.push({ field: "name", old: existing.name, new: input.name })
  }

  if (input.status !== undefined) {
    const oldStatus = STATUS_MAP[existing.status] ?? existing.status
    if (oldStatus !== input.status) {
      changes.push({ field: "status", old: oldStatus, new: input.status })
    }
  }

  if (
    input.short_description !== undefined &&
    existing.shortDescription !== input.short_description
  ) {
    changes.push({
      field: "short_description",
      old: LONG_TEXT_OLD,
      new: LONG_TEXT_NEW,
    })
  }

  if (input.description !== undefined && existing.description !== input.description) {
    changes.push({ field: "description", old: LONG_TEXT_OLD, new: LONG_TEXT_NEW })
  }

  if (input.regular_price !== undefined) {
    const oldRegular = existing.regularPrice ? String(existing.regularPrice) : ""
    if (!isSamePrice(oldRegular, input.regular_price)) {
      changes.push({ field: "regular_price", old: oldRegular, new: input.regular_price })
    }
  }

  if (input.sale_price !== undefined) {
    const oldSale = existing.salePrice ? String(existing.salePrice) : ""
    if (!isSamePrice(oldSale, input.sale_price)) {
      changes.push({ field: "sale_price", old: oldSale, new: input.sale_price })
    }
  }

  if (input.stock_status !== undefined) {
    const oldStockStatus = existing.stockStatus
      ? STOCK_STATUS_MAP[existing.stockStatus] ?? existing.stockStatus
      : "instock"
    if (oldStockStatus !== input.stock_status) {
      changes.push({ field: "stock_status", old: oldStockStatus, new: input.stock_status })
    }
  }

  if (input.stock_quantity !== undefined) {
    const oldQty = existing.stockQty !== null ? Number(existing.stockQty) : null
    if (oldQty !== input.stock_quantity) {
      changes.push({ field: "stock_quantity", old: oldQty ?? 0, new: input.stock_quantity })
    }
  }

  if (input.categories !== undefined) {
    const oldCats = existing.categories
      .map((c) => c.categoryId)
      .sort()
      .join(",")
    const newCats = input.categories
      .map((c) => c.id)
      .sort()
      .join(",")
    if (oldCats !== newCats) {
      changes.push({ field: "categories", old: oldCats, new: newCats })
    }
  }

  if (input.images !== undefined) {
    const oldImgs = existing.images.map((img) => img.url).join(",")
    const newImgs = input.images.map((img) => img.url).join(",")
    if (oldImgs !== newImgs) {
      changes.push({ field: "images", old: oldImgs, new: newImgs })
    }
  }

  return changes
}

/**
 * Harga tersimpan sebagai Decimal dan keluar sebagai `"1500000"` atau
 * `"1500000.00"` tergantung jalurnya, sementara payload mengirim string biasa.
 * Perbandingan teks apa adanya akan menganggap keduanya berbeda dan mencatat
 * perubahan harga yang tidak pernah terjadi — cukup mengganggu karena log
 * harga justru yang paling sering ditelusuri balik.
 *
 * String kosong berarti "tidak ada harga obral" dan tidak sama dengan nol.
 */
function isSamePrice(a: string, b: string): boolean {
  const aEmpty = a.trim() === ""
  const bEmpty = b.trim() === ""
  if (aEmpty || bEmpty) return aEmpty === bEmpty

  const na = Number(a)
  const nb = Number(b)
  if (Number.isNaN(na) || Number.isNaN(nb)) return a === b
  return na === nb
}

/**
 * Merangkum sekumpulan perubahan menjadi satu baris log.
 *
 * Satu perubahan disimpan apa adanya supaya kolom Field terbaca langsung.
 * Lebih dari satu disimpan sebagai JSON dengan `fieldAffected: "multiple"` —
 * bentuk yang sudah dipahami tabel log untuk dibuka per field.
 */
function summarize(changes: ProductChange[], action: string): ProductLogEntry {
  if (changes.length === 1) {
    return {
      action,
      fieldAffected: changes[0].field,
      oldValue: String(changes[0].old),
      newValue: String(changes[0].new),
    }
  }

  const oldObj: Record<string, unknown> = {}
  const newObj: Record<string, unknown> = {}
  for (const change of changes) {
    oldObj[change.field] = change.old
    newObj[change.field] = change.new
  }

  return {
    action,
    fieldAffected: "multiple",
    oldValue: JSON.stringify(oldObj),
    newValue: JSON.stringify(newObj),
  }
}

/**
 * Memecah perubahan menjadi baris-baris log, dengan harga selalu berdiri
 * sendiri sebagai `UPDATE_PRICE`.
 *
 * Menyunting nama dan harga sekaligus menghasilkan dua baris: satu
 * `EDIT_PRODUCT` untuk namanya, satu `UPDATE_PRICE` untuk harganya.
 * Sebelumnya keduanya melebur jadi satu `EDIT_PRODUCT`, sehingga perubahan
 * harga tidak muncul saat log disaring per aksi — padahal justru itu yang
 * paling sering dicari. Memisahkannya juga membuat penyaring "Update Harga"
 * benar-benar memuat seluruh perubahan harga, bukan sebagiannya.
 *
 * Urutannya sengaja menaruh `UPDATE_PRICE` lebih dulu supaya baris harga
 * mendapat `id` lebih kecil; halaman log memakai `id` sebagai pemecah seri
 * saat dua baris punya `createdAt` yang sama persis, jadi urutan tampilnya
 * tetap tetap dari waktu ke waktu.
 */
export function buildProductLogEntries(
  changes: ProductChange[],
  options: { priceAction?: string } = {},
): ProductLogEntry[] {
  const priceChanges = changes.filter((c) => PRICE_FIELDS.has(c.field))
  const otherChanges = changes.filter((c) => !PRICE_FIELDS.has(c.field))

  const entries: ProductLogEntry[] = []
  // `priceAction` ada supaya perubahan harga yang datang dari sinkronisasi
  // WooCommerce tidak menyamar sebagai suntingan manusia. Bedanya bukan
  // kosmetik: pratinjau sinkronisasi menandai produk yang harganya "pernah
  // disunting staff" dengan membaca tabel ini, dan kalau penerapannya sendiri
  // ikut tercatat sebagai UPDATE_PRICE, seluruh produk akan tertandai setelah
  // sekali penerapan dan tanda itu berhenti berarti apa-apa.
  if (priceChanges.length > 0) entries.push(summarize(priceChanges, options.priceAction ?? "UPDATE_PRICE"))
  if (otherChanges.length > 0) entries.push(summarize(otherChanges, "EDIT_PRODUCT"))

  return entries
}
