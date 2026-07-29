import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ShopSidebar } from "@/features/shop/components/shop-sidebar"
import { ShopPagination } from "@/features/shop/components/shop-pagination"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { getProductsPaginated } from "@/lib/api/woocommerce/products"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { collectCategoryAndDescendantIds } from "@/lib/utils/category-tree"
import { ProductCard } from "@/components/ui/product-card"
import { Filter } from "lucide-react"

const PER_PAGE = 24

export const metadata = {
  title: "Katalog Produk — HNS IT Center",
  description: "Cari dan temukan laptop, PC, dan komponen terbaik.",
}

// In Next.js 15, searchParams is a Promise
interface ShopPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
  // Await searchParams as required in Next.js 15
  const resolvedParams = await searchParams
  
  const categorySlug = typeof resolvedParams.category === "string" ? resolvedParams.category : undefined
  const onSale = resolvedParams.onSale === "true"
  const requestedPage = Number(resolvedParams.page)
  const page = requestedPage > 0 ? requestedPage : 1

  // perPage harus melampaui jumlah kategori: daftar yang terpotong membuat
  // sidebar kehilangan simpul terakhir, dan keturunan yang hilang dari daftar
  // ikut hilang dari hasil filter di bawah.
  const categories = await getCategories({ hideEmpty: true, perPage: 500 })

  // Memfilter kategori induk harus ikut memuat isi anak-anaknya — sama seperti
  // halaman /category/[slug]. Keduanya memakai helper yang sama supaya tidak
  // pernah lagi menjawab pertanyaan yang sama dengan cara berbeda: sebelum ini
  // /shop hanya mencocokkan satu kategori, sehingga 65 produk yang tidak
  // menyimpan kaitan ke induknya tidak pernah muncul di halaman induk itu.
  let categoryIds: number[] | undefined = undefined
  if (categorySlug) {
    const matchedCategory =
      categories.find((c) => c.slug === categorySlug) ??
      (await getCategories({ slug: categorySlug }))[0]

    if (matchedCategory) {
      categoryIds = collectCategoryAndDescendantIds(matchedCategory.id, categories)
    }
  }

  // Fetch products
  const { products: wooProducts, totalPages } = await getProductsPaginated({
    category: categoryIds,
    onSale,
    page,
    perPage: PER_PAGE,
  })

  const products = wooProducts.map(mapWooProductToUI)

  const basePathParams = new URLSearchParams()
  if (categorySlug) basePathParams.set("category", categorySlug)
  if (onSale) basePathParams.set("onSale", "true")
  const basePath = basePathParams.toString() ? `/shop?${basePathParams.toString()}` : "/shop"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight">Katalog Produk</h1>
            <div className="mt-2 text-sm text-muted-foreground">
              Menampilkan {products.length} produk
              {categorySlug && ` dalam kategori ${categorySlug}`}
              {onSale && ` (Promo)`}
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
                  <p className="text-lg font-medium text-muted-foreground">Tidak ada produk yang ditemukan.</p>
                  <p className="mt-2 text-sm text-muted-foreground">Coba ubah filter atau kata kunci pencarian Anda.</p>
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
