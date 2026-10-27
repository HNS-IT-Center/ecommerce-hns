import "server-only"

import { env } from "@/config/env"

/**
 * Klien API Data Accurate (`data.hnsitcenter.id/api/v1`) — BACA SAJA.
 *
 * Aplikasi Data Accurate menyalin Accurate Online ke databasenya sendiri
 * (terjadwal 09.00/12.00/17.00 WIB + ±5 menit setelah ada perubahan), lalu
 * membukanya lewat API ini. Dokumentasi lengkapnya di halaman
 * Pengaturan → API & Integrasi aplikasi tersebut; ringkasan & keputusan di
 * docs/13 §10.
 *
 * Token hanya hidup di server. Ia membuka HPP seluruh barang — jangan pernah
 * memanggil berkas ini dari Client Component.
 */

/** Satu barang Accurate seperti yang dikirim API dan webhook (Objek Item). */
export type HnsItem = {
  id: number
  sku: string
  name: string
  barcode: string | null
  type: string
  typeName: string | null
  unit: string | null
  category: { id: number; name: string } | null
  brand: { id: number; name: string } | null
  status: "active" | "inactive" | "deleted" | string
  manageSerialNumber: boolean
  /** Hanya ada kalau client punya izin HPP. */
  cost?: number | null
  /** Hanya ada kalau client punya izin Stok. */
  stock?: {
    total: number
    availableToSell: number | null
    warehouses: { id: number; name: string; quantity: number; countsInTotal: boolean }[]
  }
  accurateUpdatedAt: string | null
  changedAt: string | null
}

/**
 * Gudang GRIYA. Dokumentasi API Data Accurate: stok Griya JANGAN PERNAH ditarik,
 * disimpan, atau ditampilkan — Griya toko khusus yang datanya hanya untuk orang
 * yang diberi akses Griya. Tidak dihitung sebagai stok web saja tidak cukup.
 */
export const GUDANG_GRIYA = 350

/**
 * Buang stok Griya dari satu barang. Dipanggil di SETIAP pintu masuk data —
 * `fetchAllHnsItems` dan webhook — sebelum barang menyentuh apa pun.
 *
 * Penjaga utamanya pengaturan client di Data Accurate (gudang tertentu tanpa
 * Griya, 26 Oktober 2026; sebelumnya "semua gudang"). Ini cadangan kalau
 * pengaturan itu suatu hari kembali ke semua gudang: dalam keadaan itu
 * `stock.total` dan `availableToSell` ikut menghitung Griya. `total` dikurangi
 * baris yang dibuang; `availableToSell` dihitung Accurate dan tidak bisa
 * dikoreksi di sini, jadi dikosongkan.
 */
export function buangStokGriya(item: HnsItem): HnsItem {
  const stock = item.stock
  const gudang = stock?.warehouses ?? []
  if (!stock || !gudang.some((w) => w.id === GUDANG_GRIYA)) return item
  const dibuang = gudang
    .filter((w) => w.id === GUDANG_GRIYA && w.countsInTotal)
    .reduce((total, w) => total + (Number.isFinite(w.quantity) ? w.quantity : 0), 0)
  return {
    ...item,
    stock: {
      total: stock.total - dibuang,
      availableToSell: null,
      warehouses: gudang.filter((w) => w.id !== GUDANG_GRIYA),
    },
  }
}

export class HnsApiError extends Error {}

function konfigurasi(): { base: string; token: string } {
  if (!env.HNS_API_URL || !env.HNS_API_TOKEN) {
    throw new HnsApiError(
      "HNS_API_URL / HNS_API_TOKEN belum diisi — sinkron stok Accurate belum bisa dipakai (docs/07 §2.12).",
    )
  }
  return { base: env.HNS_API_URL.replace(/\/+$/, ""), token: env.HNS_API_TOKEN }
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET satu halaman, dengan dua penjaga:
 *  - 429: tunggu sesuai `Retry-After` lalu ulangi (batas API 120 request/menit);
 *  - balasan non-JSON (halaman galat proxy) jadi pesan yang bisa dibaca, bukan
 *    `Unexpected token '<'`.
 */
async function ambil<T>(path: string): Promise<T> {
  const { base, token } = konfigurasi()
  for (let percobaan = 0; percobaan < 4; percobaan++) {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (res.status === 429) {
      await tunggu(Math.min(60, Number(res.headers.get("Retry-After") ?? 10)) * 1000)
      continue
    }
    const teks = await res.text()
    let data: unknown
    try {
      data = JSON.parse(teks)
    } catch {
      throw new HnsApiError(`API Data Accurate membalas di luar format (HTTP ${res.status}).`)
    }
    if (!res.ok) {
      const pesan =
        typeof data === "object" && data !== null && "error" in data
          ? (data as { error?: { message?: string } }).error?.message
          : undefined
      throw new HnsApiError(`API Data Accurate menolak (HTTP ${res.status})${pesan ? `: ${pesan}` : ""}.`)
    }
    return data as T
  }
  throw new HnsApiError("API Data Accurate terus membatasi permintaan (429). Coba lagi semenit lagi.")
}

export type HnsStatus = {
  client: { id: number; name: string }
  scopes: { price: boolean; cost: boolean; stock: boolean; warehouseIds: number[] | null }
  lastSyncAt: string | null
  serverTime: string
}

export function getHnsStatus(): Promise<HnsStatus> {
  return ambil<HnsStatus>("/status")
}

/**
 * Seluruh barang, halaman demi halaman (500 per halaman, ±13 permintaan untuk
 * ±6.100 barang). `status=all` supaya barang yang dinonaktifkan/dihapus di
 * Accurate ikut terbaca — stoknya harus bisa turun ke 0 di web.
 */
export async function fetchAllHnsItems(): Promise<{ items: HnsItem[]; lastSyncAt: string | null }> {
  const items: HnsItem[] = []
  let lastSyncAt: string | null = null
  for (let page = 1; page <= 100; page++) {
    const { data, meta } = await ambil<{
      data: HnsItem[]
      meta: { hasMore: boolean; lastSyncAt: string | null }
    }>(`/items?status=all&limit=500&page=${page}`)
    items.push(...data.map(buangStokGriya))
    lastSyncAt ??= meta.lastSyncAt
    if (!meta.hasMore) break
  }
  return { items, lastSyncAt }
}
