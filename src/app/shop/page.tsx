import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ProductCard } from "@/components/ui/product-card"
import { getProducts } from "@/lib/api/woocommerce/products"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { ShopFilters } from "@/features/shop/components/shop-filters"
import { ShopPagination } from "@/features/shop/components/shop-pagination"

export const metadata: Metadata = {
  title: "Katalog Produk — HNS IT Center",
  description: "Temukan laptop, PC components, dan gaming gear terbaik di Batam dengan harga kompetitif dan garansi resmi.",
}

type ShopPageProps = {
  searchParams: Promise<{
    category?: string
    page?: string
    sort?: string
    min_price?: string
    max_price?: string
    search?: string
  }>
}

const PER_PAGE = 12

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams
  const currentPage = Number(params.page) || 1
  const categorySlug = params.category
  const sortParam = params.sort || "date"
  const searchQuery = params.search

  // Resolve sort param to WooCommerce orderby + order
  let orderby: "date" | "price" | "popularity" | "rating" = "date"
  let order: "asc" | "desc" = "desc"
  switch (sortParam) {
    case "price-asc":
      orderby = "price"
      order = "asc"
      break
    case "price-desc":
      orderby = "price"
      order = "desc"
      break
    case "popularity":
      orderby = "popularity"
      order = "desc"
      break
    case "rating":
      orderby = "rating"
      order = "desc"
      break
    default:
      orderby = "date"
      order = "desc"
  }

  // Resolve category slug to category ID
  let categoryId: number | undefined
  let allCategories = await getCategories({ perPage: 100 }).catch(() => [])
  
  if (categorySlug) {
    const found = allCategories.find((c) => c.slug === categorySlug)
    if (found) categoryId = found.id
  }

  // Fetch products
  const wooProducts = await getProducts({
    category: categoryId,
    page: currentPage,
    perPage: PER_PAGE,
    orderby,
    order,
    search: searchQuery,
    minPrice: params.min_price ? Number(params.min_price) : undefined,
    maxPrice: params.max_price ? Number(params.max_price) : undefined,
  }).catch(() => [])

  const products = wooProducts.map(mapWooProductToUI)

  // Estimate total pages (WooCommerce returns total in headers, but since we use fetch we approximate)
  const totalPages = products.length < PER_PAGE ? currentPage : currentPage + 1

  // Build base path for pagination links
  const queryParts: string[] = []
  if (categorySlug) queryParts.push(`category=${categorySlug}`)
  if (sortParam !== "date") queryParts.push(`sort=${sortParam}`)
  if (params.min_price) queryParts.push(`min_price=${params.min_price}`)
  if (params.max_price) queryParts.push(`max_price=${params.max_price}`)
  if (searchQuery) queryParts.push(`search=${searchQuery}`)
  const basePath = queryParts.length > 0 ? `/shop?${queryParts.join("&")}` : "/shop"

  // Active category name for breadcrumb
  const activeCategoryName = categorySlug
    ? allCategories.find((c) => c.slug === categorySlug)?.name || categorySlug
    : "Semua Produk"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Breadcrumb + Title */}
        <div className="border-b border-border/50 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
            <nav className="mb-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
              <a href="/" className="hover:text-foreground transition-colors">Beranda</a>
              <span className="mx-2">/</span>
              {categorySlug ? (
                <>
                  <a href="/shop" className="hover:text-foreground transition-colors">Katalog</a>
                  <span className="mx-2">/</span>
                  <span className="text-foreground font-medium">{activeCategoryName}</span>
                </>
              ) : (
                <span className="text-foreground font-medium">Katalog</span>
              )}
            </nav>
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              {searchQuery ? `Hasil pencarian: "${searchQuery}"` : activeCategoryName}
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
          <div className="flex flex-col gap-6 md:flex-row md:gap-10">
            {/* Sidebar Filters */}
            <ShopFilters
              categories={allCategories}
              currentCategory={categorySlug}
              currentMinPrice={params.min_price}
              currentMaxPrice={params.max_price}
              currentSort={sortParam}
            />

            {/* Product Grid + Sort */}
            <div className="flex-1">
              {/* Top bar: Result count + sort (desktop) */}
              <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Menampilkan {products.length} produk
                  {currentPage > 1 && ` — Halaman ${currentPage}`}
                </p>
                <div className="hidden md:block">
                  <form method="GET" action="/shop">
                    {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
                    {params.min_price && <input type="hidden" name="min_price" value={params.min_price} />}
                    {params.max_price && <input type="hidden" name="max_price" value={params.max_price} />}
                    <select
                      name="sort"
                      defaultValue={sortParam}
                      onChange={(e) => (e.target as HTMLSelectElement).form?.submit()}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-green"
                    >
                      <option value="date">Paling Baru</option>
                      <option value="price-asc">Harga: Rendah ke Tinggi</option>
                      <option value="price-desc">Harga: Tinggi ke Rendah</option>
                      <option value="popularity">Paling Populer</option>
                      <option value="rating">Rating Terbaik</option>
                    </select>
                  </form>
                </div>
              </div>

              {/* Grid */}
              {products.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 text-5xl">🔍</div>
                  <h3 className="text-lg font-bold">Tidak ada produk ditemukan</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Coba ubah filter atau kata kunci pencarian Anda.
                  </p>
                </div>
              )}

              {/* Pagination */}
              <ShopPagination
                currentPage={currentPage}
                totalPages={totalPages}
                basePath={basePath}
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
