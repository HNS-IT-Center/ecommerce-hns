import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { JsonLd } from "@/components/seo/json-ld"
import { getProductBySlug, getProductVariations } from "@/lib/api/woocommerce/products"
import { ProductGallery } from "@/features/product/components/product-gallery"
import { ProductInfo } from "@/features/product/components/product-info"
import { ProductTabs } from "@/features/product/components/product-tabs"
import { RelatedProducts } from "@/features/product/components/related-products"
import { resolveSiteUrl } from "@/lib/utils/site-url"
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

  // QR produk ikut host yang sedang dibuka, bukan nilai tetap dari env —
  // supaya kode yang dipindai dari halaman production tidak menunjuk localhost.
  const siteUrl = await resolveSiteUrl()

  // Atribut yang benar-benar dipakai untuk memilih varian (`variation: true`) —
  // atribut lain (mis. "Motherboard Size") cuma informasi spek, bukan pilihan.
  const variantAttributes = (product.attributes || [])
    .filter((attr) => attr.variation)
    .map((attr) => ({ name: attr.name, options: attr.options }))

  const variations =
    product.type === "variable" && product.variations.length > 0
      ? await getProductVariations(product.id)
      : []

  const brandName = product.brands?.[0]?.name || ""

  // Kategori utama dicari lewat penandanya, bukan lewat posisi. Query sudah
  // mengurutkan penanda ini ke depan, tapi pencarian eksplisit membuat maksudnya
  // terbaca dan tetap benar kalau produk datang dari query lain. Produk tanpa
  // penanda jatuh ke elemen pertama, sama seperti perilaku sebelumnya.
  const primaryCategory =
    product.categories?.find((c) => c.primary) ?? product.categories?.[0]
  const categoryName = primaryCategory?.name || "Uncategorized"

  const availabilityMap: Record<string, string> = {
    instock: "https://schema.org/InStock",
    outofstock: "https://schema.org/OutOfStock",
    onbackorder: "https://schema.org/PreOrder",
  }

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images?.map((img) => img.src) ?? [],
    description: product.short_description
      ? product.short_description.replace(/<[^>]*>/g, "")
      : undefined,
    sku: product.sku || undefined,
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    offers: {
      "@type": "Offer",
      url: `${env.NEXT_PUBLIC_SITE_URL}/product/${product.slug}`,
      priceCurrency: "IDR",
      price: product.price,
      availability: availabilityMap[product.stock_status] ?? "https://schema.org/OutOfStock",
    },
    ...(product.rating_count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.average_rating,
        reviewCount: product.rating_count,
      },
    }),
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <JsonLd data={productJsonLd} />
      <Header />
      <main className="flex-1">
        <Breadcrumb
          items={[
            { label: "Beranda", href: "/" },
            { label: "Katalog", href: "/shop" },
            ...(primaryCategory
              ? [{ label: categoryName, href: `/shop?category=${primaryCategory.slug}` }]
              : []),
            { label: product.name },
          ]}
        />

        {/* Product Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            {/* Left: Gallery */}
            <ProductGallery
              images={product.images?.map((img) => ({ src: img.src, alt: img.alt || product.name })) || []}
              videoUrl={product.video_url}
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
              type={product.type}
              stockStatus={product.stock_status}
              stockQuantity={product.stock_quantity}
              totalSales={product.total_sales}
              averageRating={product.average_rating}
              ratingCount={product.rating_count}
              whatsappNumber={env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER}
              variantAttributes={variantAttributes}
              variations={variations}
              siteUrl={siteUrl}
            />
          </div>

          {/* Tabs: Description + Specs */}
          <ProductTabs
            name={product.name}
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
