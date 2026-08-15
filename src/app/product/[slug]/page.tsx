import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { TransparentHeaderProvider } from "@/components/layout/transparent-header-provider"
import { ShareTargetProvider } from "@/components/layout/share-target-provider"
import { Footer } from "@/components/layout/footer"
import { Breadcrumb } from "@/components/seo/breadcrumb"
import { JsonLd } from "@/components/seo/json-ld"
import { getProductBySlug, getProductVariations } from "@/lib/api/woocommerce/products"
import type { GalleryImage } from "@/features/product/components/product-gallery"
import { ProductDetail } from "@/features/product/components/product-detail"
import { ProductTabs } from "@/features/product/components/product-tabs"
import { RelatedProducts } from "@/features/product/components/related-products"
import { resolveSiteUrl } from "@/lib/utils/site-url"
import { calculateProductPrice } from "@/features/product/lib/calculate-product-price"
import { formatRupiah } from "@/lib/utils"
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

  // Harga untuk teks berbagi. Dibaca dari katalog lewat helper yang sama dengan
  // panel harga — bukan dihitung ulang di sini. Lihat CLAUDE.md §2.7.
  const { finalPrice: shareFinalPrice } = calculateProductPrice({
    price: product.price,
    regularPrice: product.regular_price,
    salePrice: product.sale_price,
    onSale: product.on_sale,
  })

  const variations =
    product.type === "variable" && product.variations.length > 0
      ? await getProductVariations(product.id)
      : []

  // Atribut yang benar-benar dipakai untuk memilih varian (`variation: true`) —
  // atribut lain (mis. "Motherboard Size") cuma informasi spek, bukan pilihan.
  //
  // Daftar opsinya diambil dari varian yang benar-benar ada, bukan dari daftar
  // di induk: induk warisan Woo kerap mencantumkan warna yang varian-nya tidak
  // pernah dibuat, dan tombol seperti itu tidak akan pernah cocok dengan varian
  // mana pun — pelanggan menekannya lalu harga & tombol beli tidak muncul.
  const optionsFromVariations = new Map<string, string[]>()
  for (const variation of variations) {
    for (const attr of variation.attributes) {
      if (!attr.option) continue
      const key = attr.name.trim().toLowerCase()
      const options = optionsFromVariations.get(key) ?? []
      if (!options.includes(attr.option)) options.push(attr.option)
      optionsFromVariations.set(key, options)
    }
  }

  const variantAttributes = (product.attributes || [])
    .filter((attr) => attr.variation)
    .map((attr) => ({
      name: attr.name,
      options: optionsFromVariations.get(attr.name.trim().toLowerCase()) ?? [],
    }))
    .filter((attr) => attr.options.length > 0)

  // 69 induk warisan Woo punya varian tapi tidak mencatat satu pun atribut di
  // barisnya sendiri, jadi tak ada yang bisa ditandai `variation: true`. Nama
  // atributnya diambil langsung dari varian supaya produknya tetap bisa dipilih
  // dan dibeli, bukan jatuh ke pesan "hubungi WhatsApp".
  if (variantAttributes.length === 0 && variations.length > 0) {
    const seen = new Set<string>()
    for (const variation of variations) {
      for (const attr of variation.attributes) {
        const key = attr.name.trim().toLowerCase()
        if (!attr.name || seen.has(key)) continue
        seen.add(key)
        variantAttributes.push({
          name: attr.name,
          options: optionsFromVariations.get(key) ?? [],
        })
      }
    }
  }

  /**
   * Galeri gabungan: foto produk induk dulu, lalu foto tiap varian.
   *
   * Praktik lazim di e-commerce — pembeli bisa menggulir melihat seluruh
   * pilihan warna tanpa menekan tombolnya satu per satu. Foto varian diberi
   * label supaya jelas milik varian mana, dan `variantImageIndex` mencatat
   * slide keberapa milik varian mana sehingga keduanya bisa saling melompat.
   *
   * Varian yang gambarnya sama persis dengan gambar induk atau varian lain
   * (877 varian mewarisi gambar induk) tidak digandakan — cukup ditunjuk ke
   * slide yang sudah ada.
   */
  const galleryImages: GalleryImage[] = (product.images ?? []).map((img) => ({
    src: img.src,
    alt: img.alt || product.name,
  }))

  const variantImageIndex: Record<number, number> = {}
  for (const variation of variations) {
    const src = variation.image?.src
    if (!src) continue

    const label = variation.attributes.map((a) => a.option).filter(Boolean).join(" / ")
    const existing = galleryImages.findIndex((img) => img.src === src)

    if (existing >= 0) {
      variantImageIndex[variation.id] = existing
      // Slide yang dipakai bersama beberapa varian dibiarkan tanpa label:
      // menandainya dengan satu nama varian akan menyesatkan.
      if (galleryImages[existing].variantLabel === undefined && label) {
        galleryImages[existing].variantLabel = label
      } else if (galleryImages[existing].variantLabel !== label) {
        galleryImages[existing].variantLabel = undefined
      }
      continue
    }

    variantImageIndex[variation.id] = galleryImages.length
    galleryImages.push({
      src,
      alt: label ? `${product.name} — ${label}` : product.name,
      variantLabel: label || undefined,
    })
  }

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
      // `siteUrl` (host request), BUKAN `env.NEXT_PUBLIC_SITE_URL`. Halaman ini
      // sudah menghitung `siteUrl` di atas untuk QR code, tapi baris ini
      // terlewat — akibatnya structured data yang dibaca Google memuat
      // `http://localhost:3000/product/...` di produksi, entah sejak kapan.
      url: `${siteUrl}/product/${product.slug}`,
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
      {/* Header melayang di atas galeri sampai pembeli menggulir.

          Hanya halaman ini yang membungkus dirinya begitu; di halaman lain
          Header membaca nilai bawaan provider-nya dan tampil seperti biasa. */}
      <TransparentHeaderProvider>
        {/* Tombol bagikan di bilah mobile membaca produk ini dari sini.

            Harganya diambil lewat `calculateProductPrice` — sumber yang sama
            dengan panel harga dan bar aksi — supaya angka yang dibagikan pembeli
            tidak pernah berbeda dari yang dilihatnya di halaman. Produk
            bervariasi sengaja tidak menyertakan harga sama sekali: sebelum
            varian dipilih harganya berupa rentang, dan mengirim satu angka dari
            rentang itu berarti menjanjikan harga yang belum tentu berlaku. */}
        <ShareTargetProvider
          value={{
            title: product.name,
            priceLabel:
              product.type === "simple" ? formatRupiah(shareFinalPrice) : undefined,
            url: `${siteUrl}/p/${product.id}`,
          }}
        >
          <Header />
        </ShareTargetProvider>
      </TransparentHeaderProvider>
      <main className="flex-1">
        {/* Breadcrumb desktop saja. Di mobile ia berdiri persis di tempat yang
            dibutuhkan galeri untuk naik sampai puncak layar, dan jejak navigasi
            itu sendiri sudah diwakili tombol kembali di header. */}
        <div className="hidden md:block">
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
        </div>

        {/* Product Content.

            Padding kiri-kanan sengaja tidak dipasang di mobile: galerinya harus
            menyentuh kedua tepi layar. Blok-blok di bawahnya memasang paddingnya
            sendiri, dan strip varian ikut begitu supaya kotak pertamanya sejajar
            dengan teks di bawahnya. */}
        <div className="mx-auto max-w-7xl py-0 md:px-6 md:py-12">
          <ProductDetail
            images={galleryImages}
            videoUrl={product.video_url}
            variantImageIndex={variantImageIndex}
            info={{
              id: product.id,
              image: product.images?.[0]?.src,
              name: product.name,
              sku: product.sku,
              brand: brandName,
              categoryName,
              price: product.price,
              regularPrice: product.regular_price,
              salePrice: product.sale_price,
              onSale: product.on_sale,
              type: product.type,
              stockStatus: product.stock_status,
              stockQuantity: product.stock_quantity,
              averageRating: product.average_rating,
              ratingCount: product.rating_count,
              whatsappNumber: env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER,
              variantAttributes,
              variations,
              siteUrl,
            }}
          />

          {/* Sisa halaman memasang paddingnya sendiri di mobile — wadah di atas
              sudah melepasnya demi galeri yang menyentuh tepi layar. */}
          <div className="px-4 md:px-0">
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
        </div>
      </main>
      <Footer />
    </div>
  )
}
