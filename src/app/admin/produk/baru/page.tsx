import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { ProdukForm } from "../produk-form"

export default async function AdminProdukBaruPage() {
  const categories = await getAllCategories()

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Tambah Produk Baru</h1>
      <div className="mt-6">
        <ProdukForm categories={categories} />
      </div>
    </div>
  )
}
