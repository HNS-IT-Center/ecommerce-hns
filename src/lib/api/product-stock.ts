import type { ProductStockResponse } from "@/app/api/products/stock/route"

/**
 * Jumlah stok satu produk, dibaca dari sisi KLIEN — hanya berhasil untuk akun
 * dengan izin `stok-lihat`.
 *
 * Ditaruh di `lib/api/` supaya komponen tidak memanggil endpoint mentah
 * (CLAUDE.md §2.5). Kegagalan apa pun — ditolak, jaringan putus — dilaporkan
 * sebagai `null`, dan pemanggil cukup tidak menampilkan angka: jatuhnya ke
 * "Tersedia" polos, bukan ke tampilan yang rusak.
 */
export async function fetchProductStock(productId: number): Promise<ProductStockResponse | null> {
  try {
    const res = await fetch(`/api/products/stock?id=${productId}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as ProductStockResponse
  } catch {
    return null
  }
}
