import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ShopSidebar } from "@/features/shop/components/shop-sidebar"
import { ShopPagination } from "@/features/shop/components/shop-pagination"
import { LiveSearch } from "@/features/shop/components/live-search"
import { ShopSort } from "@/features/shop/components/shop-sort"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { getAvailableBrands } from "@/lib/api/woocommerce/brands"
import { getPrisma } from "@/lib/prisma/client"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { collectCategoryAndDescendantIds } from "@/lib/utils/category-tree"
import type { GetProductsParams } from "@/types/woocommerce"

/**
 * Nilai `orderby` yang sah, diturunkan dari `GetProductsParams` supaya daftar
 * ini tidak bisa menyimpang dari tipe aslinya: menambah/menghapus nilai di
 * `types/woocommerce.ts` langsung membuat berkas ini gagal typecheck.
 */
const ALLOWED_ORDERBY = [
  "date", "id", "include", "title", "slug", "price", "popularity", "rating", "sku",
] as const satisfies readonly NonNullable<GetProductsParams["orderby"]>[]
import { ProductCard } from "@/components/ui/product-card"
import { Filter } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

const PER_PAGE = 30

export const metadata = {
  title: "Katalog Produk — HNS IT Center",
  description: "Cari dan temukan laptop, PC, dan komponen terbaik.",
}

interface ShopPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedParams = await searchParams
  
  const onSale = resolvedParams.onSale === "true"
  const requestedPage = Number(resolvedParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  const minPrice = resolvedParams.minPrice ? Number(resolvedParams.minPrice) : undefined
  const maxPrice = resolvedParams.maxPrice ? Number(resolvedParams.maxPrice) : undefined
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined
  /**
   * `orderby`/`order` datang dari URL, jadi isinya bisa apa saja.
   *
   * Sebelumnya `as any` — yang bukan cuma pelanggaran §2.4, tapi membuat nilai
   * ngawur dari URL (`?orderby=harga-termurah`) diteruskan apa adanya ke
   * WooCommerce dan ditolak di sana, bukan diabaikan di sini. Sekarang
   * dicocokkan ke daftar nilai yang sah; yang tidak dikenali jatuh ke
   * `undefined`, artinya "pakai urutan bawaan".
   */
  const orderby = ALLOWED_ORDERBY.find((v) => v === resolvedParams.orderby)
  const order = resolvedParams.order === "asc" || resolvedParams.order === "desc"
    ? resolvedParams.order
    : undefined
  const brand = resolvedParams.brand

  const categories = await getCategories({ hideEmpty: true, perPage: 500 })

  const maxPriceAgg = await getPrisma().product.aggregate({
    _max: { regularPrice: true }
  })
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

  /**
   * Daftar merek sengaja dihitung SETELAH `categoryIds` terbentuk, supaya
   * kotak "Merek" menyaring dari kategori BESERTA KETURUNANNYA — persis
   * himpunan yang dipakai daftar produk di bawah, bukan slug mentah dari URL.
   */
  const brands = await getAvailableBrands({
    category: categoryIds,
    search,
    minPrice,
    maxPrice,
    onSale,
    brand,
  })

  const { products: wooProducts, totalPages, total } = await getProductsPaginated({
    category: categoryIds,
    onSale,
    page,
    perPage: PER_PAGE,
    brand,
    minPrice,
    maxPrice,
    search,
    orderby,
    order
  })

  const stockDisplayMode = await getStockDisplayMode()
  const products = wooProducts.map((p) => mapWooProductToUI(p, stockDisplayMode))

  const basePathParams = new URLSearchParams()
  if (resolvedParams.category) {
     const cats = Array.isArray(resolvedParams.category) ? resolvedParams.category : [resolvedParams.category]
     cats.forEach(c => basePathParams.append("category", c))
  }
  if (resolvedParams.brand) {
     const brs = Array.isArray(resolvedParams.brand) ? resolvedParams.brand : [resolvedParams.brand]
     brs.forEach(b => basePathParams.append("brand", b))
  }
  if (onSale) basePathParams.set("onSale", "true")
  if (search) basePathParams.set("search", search)
  if (minPrice) basePathParams.set("minPrice", minPrice.toString())
  if (maxPrice) basePathParams.set("maxPrice", maxPrice.toString())
  if (orderby) basePathParams.set("orderby", orderby)
  if (order) basePathParams.set("order", order)
  
  const basePath = basePathParams.toString() ? `/shop?${basePathParams.toString()}` : "/shop"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20 py-8 relative">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Katalog Produk</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              Menampilkan {products.length} dari total {total} produk
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar Desktop */}
            <div className="hidden w-64 shrink-0 md:block border-r border-border pr-6">
              <div className="pb-8">
                <ShopSidebar categories={categories} brands={brands} maxPriceLimit={maxPriceLimit} />
              </div>
            </div>

            {/* Product Grid Area */}
            <div className="flex-1 flex flex-col">
              <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between w-full">
                <div className="w-full sm:flex-1">
                  <LiveSearch />
                </div>
                <div className="w-full sm:w-auto">
                  <ShopSort />
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
                  <p className="text-lg font-medium text-muted-foreground">Tidak ada produk yang ditemukan.</p>
                  <p className="mt-2 text-sm text-muted-foreground">Coba ubah filter atau kata kunci pencarian Anda.</p>
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
                <ShopSidebar categories={categories} brands={brands} maxPriceLimit={maxPriceLimit} isMobile />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </main>
      <Footer />
    </div>
  )
}
