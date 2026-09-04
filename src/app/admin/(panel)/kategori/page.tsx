import { isDatabaseConfigured } from "@/lib/prisma/client"
import { getCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { requirePageView } from "@/lib/auth"
import { CategoryManager } from "./category-manager"

export default async function AdminKategoriPage() {
  await requirePageView("kategori")
  if (!isDatabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-warning/30 bg-warning/10 p-6 text-sm text-warning">
        Database belum dikonfigurasi — isi <code>DATABASE_URL</code> di <code>.env.local</code> lalu
        jalankan <code>npx prisma migrate deploy</code>.
      </div>
    )
  }

  const categories = await getCategoriesForAdmin()
  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0)

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Kategori</h1>
      {/* Keterangan badge sengaja TIDAK di sini lagi. Kalimat lama menyebut
          "badge hijau" padahal badge-nya biru, dan "cabang" yang dimaksud
          cabang pohon kategori — bukan cabang toko, yang juga ada di sidebar
          ini. Keduanya sekarang dijelaskan oleh legenda bercontoh di dalam
          CategoryManager, berdampingan dengan badge sungguhannya. */}
      <p className="mt-1 text-sm text-muted-foreground">
        {categories.length} kategori · {totalProducts.toLocaleString("id-ID")} kaitan produk
      </p>

      <div className="mt-6">
        <CategoryManager categories={categories} />
      </div>
    </div>
  )
}
