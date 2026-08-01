import Link from "next/link"
import { Plus } from "lucide-react"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { getCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { ProductDataTable } from "./product-data-table"

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string }>
}

const STATUS_LABEL: Record<string, string> = {
  publish: "Publish",
  draft: "Draft",
  private: "Private",
}

export default async function AdminProdukPage({ searchParams }: Props) {
  const { q, page, sort, order } = await searchParams
  const currentPage = Number(page ?? 1)
  const currentSort = (sort === "title" || sort === "sku" || sort === "price" || sort === "date") ? sort : "date"
  const currentOrder = (order === "asc" || order === "desc") ? order : "desc"

  const [{ products, totalPages }, categories] = await Promise.all([
    getProductsPaginated({
      search: q,
      page: currentPage,
      perPage: 25, // Updated to 25 per user request
      orderby: currentSort,
      order: currentOrder,
      // Draft & private wajib ikut tampil: produk baru dibuat sebagai draft, dan
      // kalau daftar ini menyaringnya, produk itu hilang begitu selesai disimpan.
      status: "any",
    }),
    getCategoriesForAdmin(),
  ])

  const rows = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    status: product.status,
    price: Number(product.price || 0),
    image: product.images?.[0]?.src ?? null,
    stockStatus: product.stock_status,
    categories: product.categories?.map(c => ({ id: c.id, name: c.name })) || [],
    brands: product.brands?.map(b => ({ name: b.name })) || [],
    dateCreated: product.date_created,
    rawProduct: product // Passed for QuickEditModal
  }))

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produk</h1>
        <Link
          href="/admin/produk/baru"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Tambah Produk Baru
        </Link>
      </div>

      <div className="mt-6">
        <ProductDataTable
          products={rows}
          categories={categories.map((c) => ({ id: c.id, path: c.path }))}
          rawCategories={categories}
          statusLabel={STATUS_LABEL}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {currentPage > 1 && (
            <Link
              href={`/admin/produk?${new URLSearchParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...(order ? { order } : {}), page: String(currentPage - 1) })}`}
              className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted"
            >
              Sebelumnya
            </Link>
          )}
          <span className="px-2 text-muted-foreground">
            Halaman {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/admin/produk?${new URLSearchParams({ ...(q ? { q } : {}), ...(sort ? { sort } : {}), ...(order ? { order } : {}), page: String(currentPage + 1) })}`}
              className="rounded-lg border border-input px-3 py-1.5 hover:bg-muted"
            >
              Berikutnya
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
