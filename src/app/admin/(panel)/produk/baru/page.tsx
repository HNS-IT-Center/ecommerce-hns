import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getAllCategories } from "@/lib/api/woocommerce/categories"
import { getProductAttributes } from "@/lib/api/woocommerce/products"
import { getBrands } from "@/lib/api/woocommerce/brands"
import { ProdukForm } from "../produk-form"
import { BACK_PARAM, listHref, sanitizeListQuery } from "../list-url"

type Props = {
  searchParams: Promise<{ [BACK_PARAM]?: string }>
}

export default async function AdminProdukBaruPage({ searchParams }: Props) {
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
      <Link
        href={listHref(returnQuery)}
        className="mb-3 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar produk
      </Link>
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
