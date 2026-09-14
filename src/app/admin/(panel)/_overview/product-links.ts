import type { ProductFlag } from "@/lib/api/woocommerce/product-health"

/**
 * Alamat daftar `/admin/produk` yang cocok dengan angka di kartu dashboard.
 *
 * Selalu membawa `status_filter=active` (terbit + draft): dashboard tidak
 * menghitung produk private, dan tanpa parameter itu daftar yang dibuka ikut
 * memuatnya sehingga jumlahnya berbeda dari yang dijanjikan kartu.
 */
export function productListHref({
  type,
  flag,
  categoryId,
}: {
  type?: "simple" | "variable"
  flag?: ProductFlag
  categoryId: number | null
}) {
  const params = new URLSearchParams({ status_filter: "active" })
  if (type) params.set("type_filter", type)
  if (flag) params.set("flag_filter", flag)
  if (categoryId !== null) params.set("category_filter", String(categoryId))
  return `/admin/produk?${params.toString()}`
}

export function productEditHref(editId: number) {
  return `/admin/produk/${editId}`
}
