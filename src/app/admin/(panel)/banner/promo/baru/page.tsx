import { requirePageView } from "@/lib/auth"
import { AdminBackLink } from "@/components/admin/admin-back-link"
import { PromoForm } from "../../promo-form"

export default async function AdminPromoBaruPage() {
  await requirePageView("banner")

  return (
    <div className="mx-auto max-w-6xl">
      <AdminBackLink href="/admin/banner?tab=promo">Kembali ke daftar promo</AdminBackLink>
      <h1 className="text-2xl font-bold">Tambah Halaman Promo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Halaman tujuan saat banner diklik — berisi produk pilihan dan hitung mundur promonya.
      </p>
      <div className="mt-6">
        <PromoForm />
      </div>
    </div>
  )
}
