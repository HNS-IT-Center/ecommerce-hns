import { buildAccuratePricePreview } from "@/lib/services/accurate-price"
import { HargaAccurateView } from "./view"

/**
 * Halaman pratinjau & penerapan harga dari Accurate (DB `updatewoo`).
 *
 * Membandingkan harga jual (`SP`) di Accurate dengan `regularPrice` katalog,
 * lewat pemetaan kode Accurate → woo_product_id yang layak dipercaya. Staff
 * memilih baris mana yang mau diterapkan; tidak ada yang ditulis otomatis.
 *
 * Proteksi login ditangani `(panel)/layout.tsx` (redirect ke /admin/login bila
 * belum masuk). Role granular ("siapa boleh lihat halaman ini") BELUM ada —
 * lihat catatan di view: untuk sekarang cukup di balik login admin.
 */
export const metadata = {
  title: "Update Harga",
}

// Selalu segar: harga di Accurate berubah, dan pratinjau basi menyesatkan.
export const dynamic = "force-dynamic"

export default async function HargaAccuratePage() {
  const preview = await buildAccuratePricePreview()

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Update Harga</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Membandingkan harga jual di Accurate dengan katalog. Centang baris yang ingin
          diterapkan, lalu simpan — hanya yang kamu pilih yang berubah.
        </p>
      </div>

      <div className="mt-6">
        <HargaAccurateView initial={preview} />
      </div>
    </div>
  )
}
