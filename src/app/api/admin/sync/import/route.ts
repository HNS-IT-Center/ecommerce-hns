import { NextRequest, NextResponse } from "next/server"

import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { WooApiError } from "@/lib/api/woocommerce/client"
import { importNewProducts } from "@/lib/api/woocommerce/sync/import"

/**
 * Mengimpor produk WooCommerce yang belum ada di katalog kita.
 *
 * Seperti endpoint penerapan harga, body hanya berisi daftar `wooId`. Seluruh
 * isi produk — nama, harga, gambar, kategori, varian — diambil server langsung
 * dari WooCommerce.
 */

export const dynamic = "force-dynamic"

/**
 * Import jauh lebih berat daripada pratinjau: satu transaksi per produk, dan
 * produk variable menambah satu permintaan HTTP untuk variannya.
 */
export const maxDuration = 300

function parseIds(raw: unknown): number[] {
  if (typeof raw !== "object" || raw === null) return []
  const value = (raw as { wooIds?: unknown }).wooIds
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0)
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body: unknown = await request.json().catch(() => ({}))
    const wooIds = parseIds(body)
    if (wooIds.length === 0) {
      return NextResponse.json({ error: "Tidak ada produk yang dipilih." }, { status: 400 })
    }

    const result = await importNewProducts(wooIds, user.name || user.email)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof WooApiError) {
      return NextResponse.json(
        { error: `WooCommerce menolak permintaan (${error.status}). Tidak ada produk yang diimpor.` },
        { status: 502 },
      )
    }
    const message = error instanceof Error ? error.message : "Gagal mengimpor produk."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
