import { requirePageView } from "@/lib/auth"
import { AdminBackLink } from "@/components/admin/admin-back-link"
import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { getProductAttributes } from "@/lib/api/woocommerce/products"
import { getBrands } from "@/lib/api/woocommerce/brands"
import { ProdukForm } from "../produk-form"
import { BACK_PARAM, listHref, sanitizeListQuery } from "../list-url"

type Props = {
  searchParams: Promise<{ [BACK_PARAM]?: string }>
}

export default async function AdminProdukBaruPage({ searchParams }: Props) {
  await requirePageView("produk")

  // Hanya untuk tombol Kembali (batal). Setelah produk dibuat, form sengaja
  // membuka daftar polos supaya produk barunya tampil di baris pertama.
  const returnQuery = sanitizeListQuery((await searchParams)[BACK_PARAM])
  const [categories, attributeOptions, brands] = await Promise.all([
    getAllCategories(),
    getProductAttributes(),
    getBrands(),
  ])

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <AdminBackLink href={listHref(returnQuery)}>Kembali ke daftar produk</AdminBackLink>
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
