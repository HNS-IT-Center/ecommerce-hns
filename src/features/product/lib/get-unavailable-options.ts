import type { ProductVariation } from "@/types/woocommerce"
import type { VariantAttribute } from "@/features/product/components/product-variant-selector"

/** Membandingkan nilai atribut apa adanya dari Woo — spasi dan kapital bebas. */
const sameOption = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Nilai atribut yang tidak bisa dipilih, mengingat pilihan yang sedang aktif.
 *
 * Katalog ini mewarisi kebiasaan WooCommerce: atribut di produk induk kerap
 * mencantumkan warna atau ukuran yang varian-nya tidak pernah dibuat. Tanpa
 * penandaan, tombol-tombol itu terlihat sama seperti yang lain — pembeli
 * menekannya, lalu harga dan tombol beli tidak muncul sama sekali tanpa
 * penjelasan apa pun.
 *
 * Yang dihitung di sini bukan cuma "varian ini ada di katalog", tapi "ada
 * varian yang cocok dengan pilihan LAIN yang sedang aktif". Jadi setelah
 * pembeli memilih "XL", warna yang tidak pernah dibuat dalam ukuran XL ikut
 * meredup — pilihan yang tersisa selalu kombinasi yang benar-benar bisa dibeli.
 *
 * Atribut yang sedang dinilai sengaja dikecualikan dari pembanding: kalau
 * disertakan, setiap nilai selain yang sedang terpilih akan selalu dianggap
 * bentrok dengan dirinya sendiri, dan seluruh tombol lain di baris itu mati.
 * Akibatnya pembeli tidak bisa berpindah warna tanpa membatalkan pilihannya
 * lebih dulu.
 *
 * Stok TIDAK ikut dipertimbangkan. Varian habis tetap bisa dipilih supaya
 * pembeli melihat harganya dan tahu barangnya memang ada — hanya sedang
 * kosong. Yang diredupkan di sini adalah kombinasi yang tidak pernah ada.
 *
 * @returns Set berisi kunci `"${namaAtribut}::${nilai}"`.
 */
export function getUnavailableOptions(
  attributes: VariantAttribute[],
  variations: ProductVariation[],
  selected: Record<string, string>,
): Set<string> {
  const unavailable = new Set<string>()

  // Tanpa data varian, tidak ada dasar untuk menyatakan apa pun mustahil —
  // lebih baik semua tombol tetap hidup daripada mematikan semuanya.
  if (variations.length === 0) return unavailable

  for (const attr of attributes) {
    for (const option of attr.options) {
      const exists = variations.some((variation) => {
        const matchesThis = variation.attributes.some(
          (a) => sameOption(a.name, attr.name) && sameOption(a.option, option),
        )
        if (!matchesThis) return false

        return attributes.every((other) => {
          if (other.name === attr.name) return true
          const chosen = selected[other.name]
          if (!chosen) return true
          return variation.attributes.some(
            (a) => sameOption(a.name, other.name) && sameOption(a.option, chosen),
          )
        })
      })

      if (!exists) unavailable.add(`${attr.name}::${option}`)
    }
  }

  return unavailable
}

/** Kunci pencarian di dalam Set hasil `getUnavailableOptions`. */
export function optionKey(attributeName: string, option: string): string {
  return `${attributeName}::${option}`
}
