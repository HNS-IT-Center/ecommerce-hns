import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Filter } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { ShopSidebar } from "@/features/shop/components/shop-sidebar"
import { ShopPagination } from "@/features/shop/components/shop-pagination"
import { ProductCard } from "@/components/ui/product-card"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { collectCategoryAndDescendantIds } from "@/lib/utils/category-tree"

const PER_PAGE = 24

type CategoryPageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

async function resolveCategory(slug: string) {
  const matches = await getCategories({ slug })
  return matches[0] ?? null
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params
  const category = await resolveCategory(slug)
  if (!category) return { title: "Kategori tidak ditemukan — HNS IT Center" }

  const description = category.description
    ? category.description.replace(/<[^>]*>/g, "").slice(0, 160)
    : `Jual ${category.name} terbaik di HNS IT Center Batam. Harga bersaing, garansi resmi.`

  return {
    title: `${category.name} — HNS IT Center`,
    description,
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams

  const category = await resolveCategory(slug)
  if (!category) notFound()

  const onSale = resolvedSearchParams.onSale === "true"
  const requestedPage = Number(resolvedSearchParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  // Fetch full category list once: needed for the sidebar tree AND to resolve
  // this category's descendant ids (parent categories include child products).
  const allCategories = await getCategories({ hideEmpty: true, perPage: 100 })
  const categoryIds = collectCategoryAndDescendantIds(category.id, allCategories)

  const { products: wooProducts, totalPages } = await getProductsPaginated({
    category: categoryIds.join(","),
    onSale,
    page,
    perPage: PER_PAGE,
  })

  const products = wooProducts.map(mapWooProductToUI)
  const basePath = onSale ? `/category/${slug}?onSale=true` : `/category/${slug}`

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <Breadcrumb
        items={[
          { label: "Beranda", href: "/" },
          { label: "Katalog", href: "/shop" },
          { label: category.name },
        ]}
      />
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">{category.name}</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              Menampilkan {products.length} produk
              {onSale && " (Promo)"}
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar Desktop */}
            <div className="hidden w-64 shrink-0 md:block">
              <div className="sticky top-24 rounded-xl border bg-card p-6 shadow-sm">
                <ShopSidebar categories={allCategories} activeCategorySlug={slug} />
              </div>
            </div>

            {/* Mobile Filter Button */}
            <div className="md:hidden">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card p-4 font-semibold shadow-sm">
                <Filter className="h-5 w-5" />
                Filter & Kategori
              </button>
              {/* Note: In a full implementation, this button would open a drawer or bottom sheet with ShopSidebar */}
            </div>

            {/* Product Grid */}
            <div className="flex-1">
              {products.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:gap-6">
                    {products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <ShopPagination currentPage={page} totalPages={totalPages} basePath={basePath} />
                </>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border bg-card border-dashed p-8 text-center">
                  <p className="text-lg font-medium text-muted-foreground">Belum ada produk di kategori ini.</p>
                  <p className="mt-2 text-sm text-muted-foreground">Coba kategori lain atau lihat semua produk di katalog.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
