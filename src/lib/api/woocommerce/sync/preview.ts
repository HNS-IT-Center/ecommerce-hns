import { buildSyncPlan } from "./diff"
import { getLocalCatalogSnapshot } from "./local"
import { fetchRemoteProducts } from "./remote"
import type { SyncPreviewResult } from "./types"

/**
 * Menyusun pratinjau sinkronisasi. **Tidak menulis apa pun.**
 *
 * Hanya membaca WooCommerce lewat HTTP dan katalog kita lewat Prisma, lalu
 * membandingkannya di `buildSyncPlan`. Tidak ada jalur tulis di berkas ini
 * maupun di berkas yang dipanggilnya — penerapan hasil pratinjau adalah
 * langkah terpisah yang dijalankan staff secara eksplisit.
 */

export type SyncPreviewOptions = {
  /**
   * Batasi pemindaian ke produk yang berubah sejak waktu ini (ISO 8601).
   *
   * Kosong = sapuan penuh (±33 halaman, belasan detik). Mode terbatas jauh
   * lebih cepat, tapi hasilnya **parsial menurut definisinya**: produk yang
   * tidak tersentuh sejak tanggal itu tidak ikut diperiksa, jadi selisih harga
   * lama tidak akan muncul. Untuk putaran pertama, pakai sapuan penuh.
   */
  modifiedAfter?: string | null
}


export async function buildSyncPreview(
  options: SyncPreviewOptions = {},
): Promise<SyncPreviewResult> {
  const scannedAt = new Date()

  // Dua sisi diambil bersamaan: keduanya lambat karena alasan berbeda (satu
  // jaringan, satu database) dan tidak saling bergantung.
  const [remote, snapshot] = await Promise.all([
    fetchRemoteProducts({ modifiedAfter: options.modifiedAfter }),
    getLocalCatalogSnapshot(),
  ])

  const plan = buildSyncPlan(remote.products, snapshot, {
    scannedAt,
    remoteCount: remote.reportedTotal,
  })

  return {
    ...plan,
    partial: Boolean(options.modifiedAfter),
    pagesFetched: remote.pagesFetched,
    truncated: remote.truncated,
  }
}
