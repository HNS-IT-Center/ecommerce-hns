import { NextRequest, NextResponse } from "next/server"

import { UnauthorizedError, requireAuth } from "@/lib/auth"
import { WooApiError } from "@/lib/api/woocommerce/client"
import { buildSyncPreview } from "@/lib/api/woocommerce/sync/preview"

/**
 * Pratinjau sinkronisasi WooCommerce -> katalog kita.
 *
 * **Endpoint ini tidak menulis apa pun.** Ia membaca dua sisi lalu
 * membandingkannya. Penerapan hasilnya ada di langkah terpisah.
 *
 * Memakai POST walaupun sifatnya membaca: parameternya masuk sebagai body, dan
 * yang lebih penting, hasilnya tidak boleh pernah tersimpan di cache mana pun —
 * pratinjau yang basi menampilkan selisih harga yang sudah tidak ada.
 *
 * Seperti /api/admin/products, endpoint ini berada di /api sehingga tidak
 * tersentuh proxy yang menjaga /admin. Tanpa `requireAuth` di bawah, seluruh
 * daftar harga katalog terbuka bagi siapa pun yang tahu alamatnya.
 */

export const dynamic = "force-dynamic"

/**
 * Sapuan penuh menembak ±33 halaman ke situs lama; 15 detik adalah waktu yang
 * wajar, dan batas bawaan 10 detik akan memotongnya di tengah jalan.
 */
export const maxDuration = 60

function parseBody(raw: unknown): { modifiedAfter: string | null } {
  if (typeof raw !== "object" || raw === null) return { modifiedAfter: null }
  const value = (raw as { modifiedAfter?: unknown }).modifiedAfter
  if (typeof value !== "string" || value.trim() === "") return { modifiedAfter: null }
  // Ditolak kalau bukan tanggal yang bisa dibaca, bukan diteruskan apa adanya:
  // WooCommerce mengabaikan `modified_after` yang tidak sah dan diam-diam
  // mengembalikan SELURUH katalog, yang akan tampak seperti sapuan penuh
  // padahal staff mengira ia memindai satu minggu terakhir.
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { modifiedAfter: null }
  return { modifiedAfter: parsed.toISOString().slice(0, 19) }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body: unknown = await request.json().catch(() => ({}))
    const { modifiedAfter } = parseBody(body)

    const plan = await buildSyncPreview({ modifiedAfter })
    return NextResponse.json(plan)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    // Situs lama sedang mati atau kredensialnya ditolak. Itu bukan kesalahan
    // panel ini, dan pesannya perlu sampai ke staff apa adanya supaya mereka
    // tahu harus memeriksa WooCommerce, bukan menekan tombol berulang kali.
    if (error instanceof WooApiError) {
      return NextResponse.json(
        { error: `WooCommerce menolak permintaan (${error.status}). Periksa situs lama dan kredensial API.` },
        { status: 502 },
      )
    }
    const message = error instanceof Error ? error.message : "Gagal menyusun pratinjau."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
