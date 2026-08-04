import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { getProductAttributes } from "@/lib/api/woocommerce/products"
import { getBrands } from "@/lib/api/woocommerce/brands"
import { ProdukForm } from "../produk-form"

export default async function AdminProdukBaruPage() {
  const [categories, attributeOptions, brands] = await Promise.all([
    getAllCategories(),
    getProductAttributes(),
    getBrands(),
  ])

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Tambah Produk Baru</h1>
      <div className="mt-6">
        <ProdukForm
          categories={categories}
          attributeOptions={attributeOptions}
          brands={brands}
        />
      </div>
    </div>
  )
}
