import type { Product } from "@/components/ui/product-card"

export async function searchProducts(query: string): Promise<Product[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error("Search failed")
  return res.json()
}

/** Bentuk jawaban `/api/products/resolve`. */
export type ResolvedProductTarget = {
  slug: string
  /** Ditampilkan di layar tunggu pemindai sebelum halamannya dibuka. */
  name: string
  variationSku: string | null
}

/**
 * Menukar identitas hasil pemindaian (id QR atau SKU barcode) menjadi slug.
 *
 * Mengembalikan `null` khusus untuk 404 — "tidak ditemukan" adalah jawaban
 * yang sah di sini, bukan kegagalan: pemindai memakainya untuk jatuh ke
 * pencarian biasa. Kegagalan jaringan dan error server tetap dilempar supaya
 * tidak tersamar sebagai "produknya memang tidak ada".
 */
export async function resolveScannedProduct(
  identity: { id: number } | { sku: string }
): Promise<ResolvedProductTarget | null> {
  const query =
    "id" in identity
      ? `id=${encodeURIComponent(String(identity.id))}`
      : `sku=${encodeURIComponent(identity.sku)}`

  const res = await fetch(`/api/products/resolve?${query}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Gagal menemukan produk")
  return res.json()
}
