import { requirePageView } from "@/lib/auth"
import { SyncView } from "./sync-view"

/**
 * Halaman pratinjau sinkronisasi WooCommerce.
 *
 * Situs WordPress lama masih dipakai staff setiap hari — produk baru masih
 * lahir di sana dan harganya masih berubah di sana. Halaman ini memperlihatkan
 * selisihnya terhadap katalog kita.
 *
 * **Tahap ini belum menulis apa pun.** Pemindaiannya sengaja dijalankan lewat
 * tombol, bukan otomatis saat halaman dibuka: satu sapuan penuh menembak
 * puluhan permintaan ke situs yang masih melayani pelanggan, dan itu tidak
 * boleh terjadi hanya karena seseorang membuka menu.
 */
export const metadata = {
  title: "Sinkronisasi WooCommerce",
}

export default async function AdminSyncPage() {
  await requirePageView("sinkronisasi")
  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Sinkronisasi WooCommerce</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Membandingkan katalog kita dengan situs lama: produk yang belum ada di sini, dan harga yang
          berbeda. Halaman ini hanya membaca — belum ada yang diubah.
        </p>
      </div>

      <div className="mt-6">
        <SyncView />
      </div>
    </div>
  )
}
