import { NextRequest, NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import { getProductByIdFresh, getProductVariationsFresh } from "@/lib/api/woocommerce/products"
import { displayStockQuantity, getStockDisplayMode } from "@/lib/api/stock-display"

export type ProductStockResponse = {
  quantity: number | null
  /** Jumlah per id varian. */
  variations: Record<number, number | null>
}

/**
 * Jumlah stok satu produk, HANYA untuk akun dengan izin `stok-lihat`.
 *
 * Angka stok sengaja tidak ikut di HTML halaman produk — halaman itu dilihat
 * tamu dan pelanggan biasa, dan apa pun yang tertulis di sana bisa dibaca lewat
 * "view source". Klien meminta angkanya ke sini setelah tahu akunnya berhak, dan
 * di sini izinnya DIPERIKSA ULANG: `canViewStock` di sesi hanya menentukan
 * perlu-tidaknya bertanya, bukan boleh-tidaknya.
 *
 * Tidak di-cache (`Fresh`): stok berubah kapan saja, dan karyawan membacanya
 * persis saat melayani pembeli.
 */
export async function GET(request: NextRequest) {
  const id = Number(request.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Parameter id tidak valid" }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 })

  const izin = await muatIzinUser(user)
  if (!bisaAkses(izin, "stok-lihat", "view")) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 })
  }

  try {
    const [product, variations, mode] = await Promise.all([
      getProductByIdFresh(id),
      getProductVariationsFresh(id),
      getStockDisplayMode(),
    ])
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 })

    const body: ProductStockResponse = {
      quantity: displayStockQuantity(product.stock_status, product.stock_quantity, mode),
      variations: Object.fromEntries(
        variations.map((v) => [v.id, displayStockQuantity(v.stock_status, v.stock_quantity, mode)])
      ),
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Failed to load product stock:", error)
    return NextResponse.json({ error: "Gagal memuat stok" }, { status: 500 })
  }
}
