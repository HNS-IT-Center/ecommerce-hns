import type { Metadata } from "next"
import { Filter } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { ShopSidebar } from "@/features/shop/components/shop-sidebar"
import { ShopPagination } from "@/features/shop/components/shop-pagination"
import { ShopSort } from "@/features/shop/components/shop-sort"
import { LiveSearch } from "@/features/shop/components/live-search"
import { ProductCard } from "@/components/ui/product-card"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { getBrands } from "@/lib/api/woocommerce/brands"
import { getPrisma } from "@/lib/prisma/client"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { collectCategoryAndDescendantIds } from "@/lib/utils/category-tree"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import type { GetProductsParams } from "@/types/woocommerce"

const PER_PAGE = 30

/**
 * Halaman ini memakai `q` (bukan `search` seperti `/shop`) karena URL
 * `/search?q=` sudah dipakai di banyak tempat: header search bar, dropdown
 * hasil pencarian, dan `SearchAction` schema.org di `layout.tsx`. Mengganti
 * namanya akan memutus semua itu, termasuk tautan yang sudah beredar.
 */
const SEARCH_PARAM = "q"

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

const ORDERBY_VALUES = ["date", "id", "include", "title", "slug", "price", "popularity", "rating", "sku"] as const
type OrderBy = NonNullable<GetProductsParams["orderby"]>

function parseOrderBy(value: string | string[] | undefined): OrderBy | undefined {
  return typeof value === "string" && (ORDERBY_VALUES as readonly string[]).includes(value)
    ? (value as OrderBy)
    : undefined
}

function parseOrder(value: string | string[] | undefined): "asc" | "desc" | undefined {
  return value === "asc" || value === "desc" ? value : undefined
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const resolved = await searchParams
  const q = typeof resolved[SEARCH_PARAM] === "string" ? resolved[SEARCH_PARAM] : ""

  return {
    title: q ? `Hasil Pencarian: "${q}" — HNS IT Center` : "Pencarian — HNS IT Center",
    // Halaman hasil pencarian tidak perlu di-index Google (thin/duplicate content).
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams

  const rawQuery = resolvedParams[SEARCH_PARAM]
  const q = typeof rawQuery === "string" ? rawQuery.trim() : ""

  const onSale = resolvedParams.onSale === "true"
  const requestedPage = Number(resolvedParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  const minPrice = resolvedParams.minPrice ? Number(resolvedParams.minPrice) : undefined
  const maxPrice = resolvedParams.maxPrice ? Number(resolvedParams.maxPrice) : undefined
  const orderby = parseOrderBy(resolvedParams.orderby)
  const order = parseOrder(resolvedParams.order)
  const brand = resolvedParams.brand

  const [categories, brands, maxPriceAgg] = await Promise.all([
    getCategories({ hideEmpty: true, perPage: 500 }),
    getBrands(),
    getPrisma().product.aggregate({ _max: { regularPrice: true } }),
  ])

  const maxPriceLimit = maxPriceAgg._max.regularPrice ? Number(maxPriceAgg._max.regularPrice) : 100000000

  let categoryIds: number[] | undefined = undefined
  if (resolvedParams.category) {
    const slugs = Array.isArray(resolvedParams.category) ? resolvedParams.category : [resolvedParams.category]
    categoryIds = []
    for (const slug of slugs) {
      const matchedCategory = categories.find((c) => c.slug === slug)
      if (matchedCategory) {
        categoryIds.push(...collectCategoryAndDescendantIds(matchedCategory.id, categories))
      }
    }
    categoryIds = Array.from(new Set(categoryIds))
    if (categoryIds.length === 0) categoryIds = undefined
  }

  const { products: wooProducts, totalPages, total } = q
    ? await getProductsPaginated({
        search: q,
        category: categoryIds,
        brand,
        onSale,
        minPrice,
        maxPrice,
        orderby,
        order,
        page,
        perPage: PER_PAGE,
      })
    : { products: [], totalPages: 0, total: 0 }

  const stockDisplayMode = await getStockDisplayMode()
  const products = wooProducts.map((p) => mapWooProductToUI(p, stockDisplayMode))

  const basePathParams = new URLSearchParams()
  if (q) basePathParams.set(SEARCH_PARAM, q)
  if (resolvedParams.category) {
    const cats = Array.isArray(resolvedParams.category) ? resolvedParams.category : [resolvedParams.category]
    cats.forEach((c) => basePathParams.append("category", c))
  }
  if (resolvedParams.brand) {
    const brs = Array.isArray(resolvedParams.brand) ? resolvedParams.brand : [resolvedParams.brand]
    brs.forEach((b) => basePathParams.append("brand", b))
  }
  if (onSale) basePathParams.set("onSale", "true")
  if (minPrice) basePathParams.set("minPrice", minPrice.toString())
  if (maxPrice) basePathParams.set("maxPrice", maxPrice.toString())
  if (orderby) basePathParams.set("orderby", orderby)
  if (order) basePathParams.set("order", order)

  const basePath = basePathParams.toString() ? `/search?${basePathParams.toString()}` : "/search"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/" },
          { label: "Katalog", href: "/shop" },
          { label: q ? `Hasil Pencarian: "${q}"` : "Pencarian" },
        ]}
      />
      <main className="flex-1 bg-muted/20 py-8 relative">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {q ? `Hasil Pencarian: "${q}"` : "Pencarian"}
            </h1>
            <div className="mt-2 text-sm text-muted-foreground">
              {q
                ? `Menampilkan ${products.length} dari total ${total} produk`
                : "Masukkan kata kunci pencarian."}
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar Desktop */}
            <div className="hidden w-64 shrink-0 md:block border-r border-border pr-6">
              <div className="pb-8">
                <ShopSidebar
                  categories={categories}
                  brands={brands}
                  maxPriceLimit={maxPriceLimit}
                  basePath="/search"
                  searchParamName={SEARCH_PARAM}
                />
              </div>
            </div>

            {/* Product Grid Area */}
            <div className="flex-1 flex flex-col">
              <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
                <div className="w-full sm:flex-1">
                  <LiveSearch basePath="/search" paramName={SEARCH_PARAM} />
                </div>
                <div className="w-full sm:w-auto">
                  <ShopSort basePath="/search" />
                </div>
              </div>

              {products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">
                    {products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <ShopPagination currentPage={page} totalPages={totalPages} basePath={basePath} />
                </>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border bg-card border-dashed p-8 text-center mt-4">
                  <p className="text-lg font-medium text-muted-foreground">
                    {q ? "Produk tidak ditemukan." : "Ketik sesuatu di kotak pencarian untuk mulai mencari."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Coba ubah filter atau kata kunci pencarian Anda.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Filter Bubble Overlay */}
        <div className="md:hidden fixed bottom-[160px] right-4 z-40">
          <Sheet>
            <SheetTrigger className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-xl hover:bg-black/80 transition-transform active:scale-95">
              <Filter className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] sm:w-[400px] overflow-y-auto px-6 py-6 custom-scrollbar">
              <VisuallyHidden>
                <SheetTitle>Filter & Urutkan</SheetTitle>
              </VisuallyHidden>
              <div className="flex flex-col gap-6 pt-4">
                <ShopSidebar
                  categories={categories}
                  brands={brands}
                  maxPriceLimit={maxPriceLimit}
                  basePath="/search"
                  searchParamName={SEARCH_PARAM}
                  isMobile
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </main>
      <Footer />
    </div>
  )
}
