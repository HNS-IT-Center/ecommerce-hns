import Link from "next/link"
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { getCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { ProductDataTable } from "./product-data-table"

type Props = {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; order?: string; status_filter?: string }>
}

export default async function AdminProdukPage({ searchParams }: Props) {
  const { q, page, sort, order, status_filter } = await searchParams
  const currentPage = Number(page ?? 1)
  const currentSort = (sort === "title" || sort === "sku" || sort === "price" || sort === "date") ? sort : "date"
  const currentOrder = (order === "asc" || order === "desc") ? order : "desc"

  let apiStatus: "publish" | "draft" | "private" | "any" = "any"
  let apiStockStatus: "instock" | "outofstock" | "onbackorder" | undefined = undefined

  if (status_filter === "publish" || status_filter === "draft" || status_filter === "private") {
    apiStatus = status_filter
  } else if (status_filter === "empty_stock") {
    apiStockStatus = "outofstock"
  }

  const [{ products, totalPages }, categories] = await Promise.all([
    getProductsPaginated({
      search: q,
      page: currentPage,
      perPage: 25,
      orderby: currentSort as any,
      order: currentOrder,
      status: apiStatus,
      stock_status: apiStockStatus,
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
    rawProduct: product
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
          rawCategories={categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            parent: c.parentId || 0,
            description: "",
            display: "default",
            image: null,
            menu_order: 0,
            count: c.productCount,
          }))}
        />
      </div>

      {totalPages > 1 && (
        (() => {
          const buildUrl = (p: number) => {
            const params = new URLSearchParams()
            if (q) params.set("q", q)
            if (sort) params.set("sort", sort)
            if (order) params.set("order", order)
            if (status_filter) params.set("status_filter", status_filter)
            params.set("page", String(p))
            return `/admin/produk?${params.toString()}`
          }

          let startPage = Math.max(1, currentPage - 2)
          let endPage = Math.min(totalPages, startPage + 4)
          if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4)
          }

          const pageNumbers = []
          for (let i = startPage; i <= endPage; i++) {
            pageNumbers.push(i)
          }

          return (
            <div className="mt-6 flex items-center justify-center gap-1.5 text-sm">
              <Link
                href={buildUrl(Math.max(1, currentPage - 10))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Mundur 10 Halaman"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Link>
              <Link
                href={buildUrl(Math.max(1, currentPage - 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>

              {pageNumbers.map((p) => (
                <Link
                  key={p}
                  href={buildUrl(p)}
                  className={`flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 transition-colors ${
                    p === currentPage
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              ))}

              <Link
                href={buildUrl(Math.min(totalPages, currentPage + 1))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href={buildUrl(Math.min(totalPages, currentPage + 10))}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-input transition-colors ${
                  currentPage === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"
                }`}
                title="Maju 10 Halaman"
              >
                <ChevronsRight className="h-4 w-4" />
              </Link>
            </div>
          )
        })()
      )}
    </div>
  )
}
