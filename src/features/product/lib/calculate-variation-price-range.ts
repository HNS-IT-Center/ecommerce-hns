import type { ProductVariation } from "@/types/woocommerce"

export type VariationPriceRange = {
  min: number
  max: number
  /** `true` saat seluruh varian berharga sama — tampilkan satu angka, bukan rentang. */
  isSingle: boolean
}

/**
 * Harga yang benar-benar dibayar untuk satu varian.
 *
 * `price` dari WooCommerce sudah mencerminkan harga sale saat varian sedang
 * diskon, tapi tidak semua varian hasil migrasi konsisten — sebagian punya
 * `sale_price` terisi sementara `price` masih harga lama. Sale price
 * didahulukan saat varian ditandai `on_sale` supaya rentangnya tidak pernah
 * lebih tinggi dari yang tampil setelah varian dipilih.
 */
function resolveVariationPrice(variation: ProductVariation): number | null {
  const raw =
    variation.on_sale && variation.sale_price ? variation.sale_price : variation.price

  const parsed = parseInt(raw || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Rentang harga sebuah produk bervariasi, untuk ditampilkan SEBELUM pembeli
 * memilih varian.
 *
 * Produk bervariasi tidak punya satu harga — menampilkan `price` induk
 * menyesatkan karena angka itu cuma salah satu varian. Yang ditampilkan di
 * sini adalah batas bawah dan atas dari varian yang ada, sehingga pembeli tahu
 * kisarannya sebelum menelusuri opsi.
 *
 * Diskon member sengaja TIDAK diterapkan di sini: potongan 5% masih placeholder
 * dan belum mencerminkan aturan harga yang sebenarnya.
 *
 * Varian habis stok tetap ikut dihitung. Rentang yang menyusut mengikuti stok
 * berubah-ubah tanpa alasan yang terlihat oleh pembeli, dan harga terendah yang
 * hilang-timbul lebih membingungkan daripada varian yang ternyata perlu
 * ditunggu.
 *
 * Mengembalikan `null` bila tidak ada satu pun varian berharga valid — pemanggil
 * jatuh kembali ke harga induk.
 */
export function calculateVariationPriceRange(
  variations: ProductVariation[],
): VariationPriceRange | null {
  const prices: number[] = []
  for (const variation of variations) {
    const price = resolveVariationPrice(variation)
    if (price !== null) prices.push(price)
  }

  if (prices.length === 0) return null

  const min = Math.min(...prices)
  const max = Math.max(...prices)

  return { min, max, isSingle: min === max }
}
