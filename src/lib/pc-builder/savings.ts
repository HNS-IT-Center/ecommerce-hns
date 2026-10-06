/**
 * "Total sebelum diskon" dan "Anda hemat" untuk rakitan PC — SATU rumus yang
 * dipakai panel `/build-pc`, PDF quotation (`/build-pc/print`), dan `/q/<token>`.
 *
 * ## Kenapa ini sah menurut CLAUDE.md §2.7
 *
 * Tidak ada harga baru yang lahir di sini. Kedua angka yang dibandingkan berasal
 * dari katalog: `regularPrice` dan harga yang benar-benar dibayar (`salePrice`
 * yang masih berlaku, atau `regularPrice` itu sendiri). "Hemat" hanyalah
 * KETERANGAN atas selisih keduanya — kedudukannya sama dengan persentase diskon
 * yang sudah tampil di kartu produk.
 *
 * ## Yang dijaga
 *
 * Harga normal hanya dipakai kalau ia benar-benar DI ATAS harga yang dibayar.
 * Data katalog warisan impor WooCommerce kadang ber-`regularPrice` nol, atau
 * lebih kecil dari `salePrice`-nya; tanpa penjaga ini panel bisa menampilkan
 * "hemat" negatif atau coretan yang lebih murah dari harga akhirnya.
 *
 * Berkas ini tidak mengimpor apa pun, jadi Client Component boleh memakainya.
 */

/**
 * Harga normal satuan yang layak dicoret, atau `null` kalau baris ini memang
 * tidak didiskon.
 */
export function discountedRegularPrice(
  regularPrice: number | null | undefined,
  paidUnitPrice: number,
): number | null {
  if (typeof regularPrice !== "number" || !Number.isFinite(regularPrice)) return null
  if (!Number.isFinite(paidUnitPrice) || paidUnitPrice < 0) return null
  return regularPrice > paidUnitPrice ? regularPrice : null
}

export type SavingsLine = {
  /** Harga satuan yang dibayar — sama dengan yang dijumlahkan ke total. */
  price: number
  /** Harga normal satuan dari katalog. `undefined`/`null` = tidak diketahui. */
  regularPrice?: number | null
  quantity: number
}

export type BuildSavings = {
  /** Total yang DIBAYAR, apa adanya dari pemanggil. */
  total: number
  /** `total` + `savings`. Sama dengan `total` kalau tidak ada yang didiskon. */
  totalBeforeDiscount: number
  /** Selalu ≥ 0. Nol = jangan tampilkan baris "Anda hemat" sama sekali. */
  savings: number
}

/**
 * `total` sengaja dioper pemanggil, bukan dijumlahkan ulang di sini: di PDF ia
 * adalah `pc_build_quotes.total` yang tersimpan (sudah termasuk biaya rakit),
 * dan di panel ia adalah `displayedTotal`. Total sebelum diskon diturunkan dari
 * angka itu ditambah selisihnya, sehingga keduanya mustahil tidak cocok.
 */
export function summarizeBuildSavings(
  lines: Iterable<SavingsLine>,
  total: number,
): BuildSavings {
  let savings = 0
  for (const line of lines) {
    const regular = discountedRegularPrice(line.regularPrice, line.price)
    if (regular === null) continue
    const qty = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0
    savings += (regular - line.price) * qty
  }
  return { total, totalBeforeDiscount: total + savings, savings }
}
