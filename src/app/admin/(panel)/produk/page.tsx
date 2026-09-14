import Link from "next/link"
import { Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { getProductsPaginated, getProductAttributes } from "@/lib/api/woocommerce/products"
import { getCategoriesForAdmin, getRootCategoriesForAdmin } from "@/lib/api/woocommerce/categories"
import { countFlaggedVariationsByParent, resolveCategoryScope } from "@/lib/api/woocommerce/product-health"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { requirePageView } from "@/lib/auth"
import { ProductDataTable } from "./product-data-table"
import { StockDisplayToggle } from "./stock-display-toggle"

type Props = {
  searchParams: Promise<{
    q?: string
    page?: string
    sort?: string
    order?: string
    status_filter?: string
    type_filter?: string
    flag_filter?: string
    category_filter?: string
  }>
}

export default async function AdminProdukPage({ searchParams }: Props) {
  await requirePageView("produk")
  const { q, page, sort, order, status_filter, type_filter, flag_filter, category_filter } = await searchParams
  const currentPage = Number(page ?? 1)
  const currentSort = (sort === "title" || sort === "sku" || sort === "price" || sort === "date") ? sort : "date"
  const currentOrder = (order === "asc" || order === "desc") ? order : "desc"

  const apiStatus =
    status_filter === "publish" ||
    status_filter === "draft" ||
    status_filter === "private" ||
    status_filter === "active"
      ? status_filter
      : "any"

  // Tipe adalah dimensi terpisah dari status, jadi keduanya bisa dikombinasikan
  // — mis. "Draft" + "Bervariasi" untuk memeriksa produk varian yang belum
  // terbit.
  const apiType =
    type_filter === "simple" || type_filter === "variable" ? type_filter : undefined

  // `status_filter=empty_stock` adalah bentuk lama, dari masa "Stok Kosong"
  // masih menumpang di dropdown status. Tetap diterima supaya tautan yang
  // terlanjur tersimpan tidak diam-diam kehilangan penyaringnya.
  const apiFlag =
    flag_filter === "missing-sku" || flag_filter === "empty-stock"
      ? flag_filter
      : status_filter === "empty_stock"
        ? "empty-stock"
        : undefined

  const parsedCategory = Number(category_filter)
  const categoryId = Number.isInteger(parsedCategory) && parsedCategory > 0 ? parsedCategory : null
  const categoryScope = categoryId === null ? undefined : await resolveCategoryScope(categoryId)

  const [{ products, totalPages }, categories, rootCategories, attributeOptions, stockDisplayMode] = await Promise.all([
    getProductsPaginated({
      search: q,
      page: currentPage,
      perPage: 25,
      orderby: currentSort,
      order: currentOrder,
      status: apiStatus,
      type: apiType,
      flag: apiFlag,
      // Daftar kosong berarti id kategori tidak dikenal. Ia tetap diteruskan
      // sebagai `[0]`, bukan dibuang: `buildPrismaWhere` mengabaikan array
      // kosong, dan penyaring yang diabaikan menampilkan SEMUA produk di bawah
      // label kategori yang dipilih.
      category: categoryScope ? (categoryScope.length > 0 ? categoryScope : [0]) : undefined,
    }),
    getCategoriesForAdmin(),
    getRootCategoriesForAdmin(),
    getProductAttributes(),
    getStockDisplayMode(),
  ])

  const flaggedVariations = await countFlaggedVariationsByParent(
    products.filter((product) => product.type === "variable").map((product) => product.id)
  )

  const rows = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku ?? "",
    status: product.status,
    // Penanda produk bervariasi + jumlah varian, supaya staff tahu sebelum
    // membuka form bahwa harga yang tampil adalah "mulai dari" dan bahwa
    // produk ini punya anak yang ikut terpengaruh.
    type: product.type,
    variationCount: product.variations?.length ?? 0,
    // Induk bervariasi masuk daftar "SKU/stok kosong" karena VARIANNYA, sementara
    // kolom induknya sendiri memang kosong — tanpa angka ini barisnya tak bisa
    // dibedakan dari induk yang sudah beres.
    flaggedVariations: flaggedVariations.get(product.id) ?? { "missing-sku": 0, "empty-stock": 0 },
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

      {/* Sakelar tampilan stok berdiri di atas tabel, bukan di dalam bilah
          filter: filter di sana hanya mengubah apa yang dilihat staff di
          halaman ini, sedangkan sakelar ini mengubah apa yang dilihat
          PELANGGAN di seluruh situs. */}
      <div className="mt-6">
        <StockDisplayToggle mode={stockDisplayMode} />
      </div>

      <div className="mt-4">
        <ProductDataTable
          products={rows}
          attributeOptions={attributeOptions}
          rootCategories={rootCategories}
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
            if (type_filter) params.set("type_filter", type_filter)
            if (flag_filter) params.set("flag_filter", flag_filter)
            if (category_filter) params.set("category_filter", category_filter)
            params.set("page", String(p))
            return `/admin/produk?${params.toString()}`
          }

          let startPage = Math.max(1, currentPage - 2)
          const endPage = Math.min(totalPages, startPage + 4)
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
