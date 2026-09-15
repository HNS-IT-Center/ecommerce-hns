import { Metadata } from "next"
import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"
import { bisaAkses, muatIzinUser } from "@/lib/auth/permissions"
import {
  getLatestProducts,
  getProductFlagSummary,
  getProductLogActions,
  getProductTypeTotals,
  getRecentProductLogs,
} from "@/lib/api/admin-dashboard"
import { getRootCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { ComingSoonActions } from "./_overview/coming-soon-actions"
import { LatestProductsCard } from "./_overview/latest-products-card"
import { ProductFlagCard } from "./_overview/product-flag-card"
import { ProductTotalsCard } from "./_overview/product-totals-card"
import { RecentLogsCard } from "./_overview/recent-logs-card"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Admin Dashboard",
}

// Angka di dashboard harus mencerminkan keadaan saat dibuka — staff memeriksa
// di sini apakah SKU, stok, atau foto yang baru mereka isi sudah keluar dari daftar.
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/admin/login")

  /**
   * Halaman ini TIDAK memakai `requirePageView`: `/admin` adalah tujuan
   * pengalihan untuk setiap halaman yang ditolak, jadi ia harus terbuka bagi
   * semua admin — kalau tidak, user tanpa izin produk terlempar berputar.
   * Sebagai gantinya tiap kartu disaring izinnya sendiri, dan server action
   * kartunya memeriksa ulang.
   */
  const izin = await muatIzinUser(user)
  const canViewProducts = bisaAkses(izin, "produk")
  const canViewLogs = bisaAkses(izin, "logs")

  const [productData, logData] = await Promise.all([
    canViewProducts
      ? Promise.all([
          getRootCategoriesForAdmin(),
          getProductTypeTotals(null),
          getProductFlagSummary("missing-sku", null),
          getProductFlagSummary("empty-stock", null),
          getLatestProducts(),
          getProductFlagSummary("missing-image", null),
        ])
      : null,
    canViewLogs ? Promise.all([getRecentProductLogs("price"), getProductLogActions()]) : null,
  ])

  return (
    <div className="mx-auto min-w-0 max-w-350 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Ringkasan katalog & aktivitas terbaru</p>
        </div>
        <ComingSoonActions />
      </div>

      {!productData && !logData && (
        <p className="rounded-2xl bg-card px-5 py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          Belum ada ringkasan yang bisa ditampilkan untuk akses akun Anda.
        </p>
      )}

      {productData && (
        <>
          <ProductTotalsCard categories={productData[0]} initial={productData[1]} />
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <ProductFlagCard flag="missing-sku" categories={productData[0]} initial={productData[2]} />
            <ProductFlagCard flag="empty-stock" categories={productData[0]} initial={productData[3]} />
            {/* Satu-satunya flag yang langsung terlihat pelanggan (kartu toko
                tanpa foto), jadi dibentangkan penuh supaya tidak tenggelam. */}
            <ProductFlagCard
              flag="missing-image"
              categories={productData[0]}
              initial={productData[5]}
              className="lg:col-span-2"
            />
          </div>
        </>
      )}

      {(productData || logData) && (
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
          {productData && <LatestProductsCard products={productData[4]} />}
          {logData && <RecentLogsCard initial={logData[0]} availableActions={logData[1]} />}
        </div>
      )}
    </div>
  )
}
