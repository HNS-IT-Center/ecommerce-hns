import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getProductBySlug } from "@/lib/api/woocommerce/products"
import { ProductGallery } from "@/features/product/components/product-gallery"
import { ProductInfo } from "@/features/product/components/product-info"
import { ProductTabs } from "@/features/product/components/product-tabs"
import { RelatedProducts } from "@/features/product/components/related-products"
import { env } from "@/config/env"

type ProductPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: "Produk tidak ditemukan — HNS IT Center" }

  return {
    title: `${product.name} — HNS IT Center`,
    description: product.short_description
      ? product.short_description.replace(/<[^>]*>/g, "").slice(0, 160)
      : `Beli ${product.name} di HNS IT Center Batam. Harga terbaik, garansi resmi.`,
    openGraph: {
      images: product.images?.[0]?.src ? [product.images[0].src] : [],
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) notFound()

  // Extract brand from attributes
  const brandAttr = product.attributes?.find(
    (a) => a.slug === "merk" || a.slug === "brand" || a.slug === "pa_brand"
  )
  const brandName = brandAttr?.options?.[0] || ""

  // Primary category
  const primaryCategory = product.categories?.[0]
  const categoryName = primaryCategory?.name || "Uncategorized"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b border-border/50 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
            <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
              <a href="/" className="hover:text-foreground transition-colors">Beranda</a>
              <span className="mx-2">/</span>
              <a href="/shop" className="hover:text-foreground transition-colors">Katalog</a>
              {primaryCategory && (
                <>
                  <span className="mx-2">/</span>
                  <a
                    href={`/shop?category=${primaryCategory.slug}`}
                    className="hover:text-foreground transition-colors"
                  >
                    {categoryName}
                  </a>
                </>
              )}
              <span className="mx-2">/</span>
              <span className="text-foreground font-medium line-clamp-1">{product.name}</span>
            </nav>
          </div>
        </div>

        {/* Product Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            {/* Left: Gallery */}
            <ProductGallery
              images={product.images?.map((img) => ({ src: img.src, alt: img.alt || product.name })) || []}
            />

            {/* Right: Product Info */}
            <ProductInfo
              id={product.id}
              image={product.images?.[0]?.src}
              name={product.name}
              sku={product.sku}
              brand={brandName}
              categoryName={categoryName}
              price={product.price}
              regularPrice={product.regular_price}
              salePrice={product.sale_price}
              onSale={product.on_sale}
              stockStatus={product.stock_status}
              stockQuantity={product.stock_quantity}
              totalSales={product.total_sales}
              averageRating={product.average_rating}
              ratingCount={product.rating_count}
              whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}
            />
          </div>

          {/* Tabs: Description + Specs */}
          <ProductTabs
            description={product.description || ""}
            shortDescription={product.short_description || ""}
            attributes={product.attributes || []}
          />

          {/* Related Products */}
          {primaryCategory && (
            <RelatedProducts
              categoryId={primaryCategory.id}
              excludeId={product.id}
            />
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
