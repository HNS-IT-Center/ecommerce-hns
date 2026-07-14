import type { Metadata } from "next"
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

const PER_PAGE = 24

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const resolved = await searchParams
  const q = typeof resolved.q === "string" ? resolved.q : ""

  return {
    title: q ? `Hasil Pencarian: "${q}" — HNS IT Center` : "Pencarian — HNS IT Center",
    // Halaman hasil pencarian tidak perlu di-index Google (thin/duplicate content).
    robots: { index: false, follow: true },
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams

  const q = typeof resolvedParams.q === "string" ? resolvedParams.q.trim() : ""
  const onSale = resolvedParams.onSale === "true"
  const requestedPage = Number(resolvedParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  const categories = await getCategories({ hideEmpty: true, perPage: 100 })

  const { products: wooProducts, totalPages } = q
    ? await getProductsPaginated({ search: q, onSale, page, perPage: PER_PAGE })
    : { products: [], totalPages: 0 }

  const products = wooProducts.map(mapWooProductToUI)
  const basePath = onSale
    ? `/search?q=${encodeURIComponent(q)}&onSale=true`
    : `/search?q=${encodeURIComponent(q)}`

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
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">
              {q ? `Hasil Pencarian: "${q}"` : "Pencarian"}
            </h1>
            <div className="mt-2 text-sm text-muted-foreground">
              {q ? `Menampilkan ${products.length} produk${onSale ? " (Promo)" : ""}` : "Masukkan kata kunci pencarian."}
            </div>
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar Desktop */}
            <div className="hidden w-64 shrink-0 md:block">
              <div className="sticky top-24 rounded-xl border bg-card p-6 shadow-sm">
                <ShopSidebar categories={categories} />
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
                  <p className="text-lg font-medium text-muted-foreground">
                    {q ? "Produk tidak ditemukan." : "Ketik sesuatu di kotak pencarian untuk mulai mencari."}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Coba ubah kata kunci, atau lihat semua produk di katalog.
                  </p>
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
