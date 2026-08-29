import { NextRequest, NextResponse } from "next/server"

import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { WooApiError } from "@/lib/api/woocommerce/client"
import { applyPriceChanges } from "@/lib/api/woocommerce/sync/apply"

/**
 * Menerapkan perubahan harga yang dipilih staff di halaman sinkronisasi.
 *
 * Body hanya berisi **daftar `wooId`** — tidak ada harga di dalamnya. Harganya
 * diambil ulang dari WooCommerce di dalam `applyPriceChanges`. Endpoint yang
 * menerima harga dari klien berarti siapa pun yang bisa memanggilnya bisa
 * menetapkan harga katalog (CLAUDE.md §2.7).
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

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

    // Nama pemilik sesi, bukan "System": yang memutuskan menerapkan adalah
    // orang, dan halaman log harus bisa menunjukkan siapa.
    const result = await applyPriceChanges(wooIds, user.name || user.email)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof WooApiError) {
      return NextResponse.json(
        { error: `WooCommerce menolak permintaan (${error.status}). Tidak ada harga yang diubah.` },
        { status: 502 },
      )
    }
    const message = error instanceof Error ? error.message : "Gagal menerapkan perubahan."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
