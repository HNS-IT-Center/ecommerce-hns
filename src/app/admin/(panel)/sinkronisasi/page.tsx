import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { requirePageView } from "@/lib/auth"

/**
 * Halaman sinkronisasi WooCommerce — DINONAKTIFKAN SEMENTARA.
 *
 * Situs WordPress lama sudah tidak terjangkau dari mana pun:
 *
 *   hnsitcenter.id/wp-json/wc/v3/products      -> 404
 *   old.hnsitcenter.id/wp-json/wc/v3/products  -> tidak menjawab
 *
 * Domain utama kini melayani situs Next.js ini, dan alamat pindahan yang
 * tercatat di `scripts/isi-woo-slug.mts` juga mati. Selama itu, menekan tombol
 * pindai hanya menghasilkan galat 502 tanpa keterangan — staff melihat sesuatu
 * yang tampak rusak, padahal sumbernya memang sudah tidak ada.
 *
 * `SyncView` beserta seluruh jalurnya (`lib/api/woocommerce/sync/*`,
 * `api/admin/sync/*`) SENGAJA TIDAK DIHAPUS. Kalau situs lama dihidupkan lagi
 * di alamat baru, menghidupkan halaman ini cukup: perbarui `WOOCOMMERCE_URL`,
 * kembalikan `import { SyncView } from "./sync-view"`, dan ganti blok
 * pemberitahuan di bawah dengan `<SyncView />`.
 *
 * Catatan untuk yang meninjau nanti: migrasi produknya sendiri tampak sudah
 * tuntas — 3.326 dari 3.330 produk induk bersumber `WOO`, dan antrean dorong
 * balik (`product_sync_jobs`) kosong. Jadi pilihan yang sebenarnya bukan cuma
 * "hidupkan lagi", melainkan juga "pensiunkan sekalian".
 */
export const metadata = {
  title: "Sinkronisasi WooCommerce",
}

export default async function AdminSyncPage() {
  await requirePageView("sinkronisasi")

  return (
    <div className="mx-auto max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Sinkronisasi WooCommerce</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Membandingkan katalog dengan situs WordPress lama.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-warning/40 bg-warning/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div className="min-w-0 space-y-3">
            <h2 className="text-base font-semibold">Fitur ini sedang tidak aktif</h2>

            <p className="text-sm text-muted-foreground">
              Situs WordPress lama sudah tidak bisa dihubungi, jadi tidak ada yang bisa
              dibandingkan. Halaman ini dimatikan supaya tidak menampilkan galat yang
              terlihat seperti kerusakan.
            </p>

            <p className="text-sm text-muted-foreground">
              Katalog produk <strong className="text-foreground">tidak terpengaruh</strong> —
              seluruh data produk sudah lama dibaca dari database sendiri, bukan dari situs
              lama. Menambah dan mengubah produk tetap berjalan seperti biasa.
            </p>

            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-medium">Yang masih berjalan seperti biasa:</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li>
                  &middot;{" "}
                  <Link href="/admin/produk" className="text-primary underline-offset-2 hover:underline">
                    Semua Produk
                  </Link>{" "}
                  — menambah, mengubah, dan menghapus produk
                </li>
                <li>
                  &middot;{" "}
                  <Link
                    href="/admin/harga-accurate"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Update Harga
                  </Link>{" "}
                  — harga dan penautan ke Accurate
                </li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Kalau situs lama dihidupkan lagi, halaman ini bisa diaktifkan kembali tanpa
              menulis ulang apa pun — kodenya masih utuh.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
