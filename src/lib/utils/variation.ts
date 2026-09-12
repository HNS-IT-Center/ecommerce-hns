/**
 * Satu aturan penamaan varian untuk seluruh aplikasi.
 *
 * Sebelum berkas ini ada, aturannya hidup di dua tempat: `labelVarian()` di
 * `lib/pc-prebuild/products.ts` dan `namaTampil()` + pemetaan `variationLabel`
 * di `lib/pc-prebuild/resolve.ts`. Keduanya kebetulan sama, dan "kebetulan
 * sama" adalah keadaan yang selalu berakhir dengan dua label berbeda untuk
 * barang yang sama — satu di panel admin, satu di dokumen yang dipegang
 * pelanggan.
 *
 * KENAPA LABEL DIRANGKAI DARI NILAI ATRIBUT, BUKAN DARI `name`
 * Nama baris VARIATION tidak bisa dipercaya sebagai pembeda. Varian yang
 * dibuat lewat panel admin memang bernama `"<induk> - <label>"` (lihat
 * `saveProductVariations` di `lib/api/woocommerce/products.ts`), tapi varian
 * warisan impor WooCommerce sering hanya mengulang nama induknya utuh. Kalau
 * label bersandar pada `name`, dua varian bisa tampil dengan tulisan yang
 * persis sama — dan pelanggan memilih di antara dua baris yang tidak
 * terbedakan.
 */

/** Pemisah antar nilai atribut, mis. "1TB · Hitam". */
const PEMISAH_NILAI = " · "

/** Pemisah antara nama induk dan label variannya. */
const PEMISAH_NAMA = " — "

/**
 * Label varian dari nilai-nilai atributnya. `null` kalau tidak ada nilai yang
 * bisa dipakai — pemanggil yang memutuskan apa gantinya, karena jawabannya
 * berbeda antara kartu produk dan baris dokumen.
 */
export function buildVariationLabel(
  values: Array<string | null | undefined>
): string | null {
  const bersih = values.map((v) => (v ?? "").trim()).filter(Boolean)
  return bersih.length > 0 ? bersih.join(PEMISAH_NILAI) : null
}

/**
 * Nama yang layak dibaca manusia: induk + label varian kalau keduanya ada.
 *
 * Keduanya WAJIB ada. Produk SIMPLE juga punya atribut, dan menempelkan
 * atributnya sebagai "varian" akan membuat setiap komponen tampak bervarian.
 */
export function displayVariationName(input: {
  name: string
  parentName?: string | null
  variationLabel?: string | null
}): string {
  if (input.parentName && input.variationLabel) {
    return `${input.parentName}${PEMISAH_NAMA}${input.variationLabel}`
  }
  return input.name
}

/**
 * Varian TERMURAH yang masih ada stoknya — angka yang layak dipasang sebagai
 * "mulai dari" di kartu produk bervarian.
 *
 * "Yang masih ada stoknya" bukan detail kosmetik. CLAUDE.md §2.7 melarang
 * menampilkan harga yang tidak bisa diperoleh siapa pun, dan angka dari varian
 * yang sudah habis persis termasuk di dalamnya. Kalau semuanya habis, kartunya
 * sendiri sudah tidak bisa ditekan — barulah yang termurah apa adanya dipakai,
 * semata supaya kartunya tidak tampil "Rp 0".
 *
 * Tidak ada perhitungan di sini: yang dilakukan cuma MEMILIH satu angka katalog
 * dari beberapa angka katalog.
 */
export function cheapestAvailableVariation<T extends { price: number; stock: number }>(
  variations: T[]
): T | null {
  const berharga = variations.filter((v) => v.price > 0)
  if (berharga.length === 0) return null

  const tersedia = berharga.filter((v) => v.stock > 0)
  const kandidat = tersedia.length > 0 ? tersedia : berharga

  return kandidat.reduce((termurah, v) => (v.price < termurah.price ? v : termurah))
}
