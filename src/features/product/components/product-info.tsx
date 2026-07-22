"use client"

import { useState } from "react"
import { Shield, Truck, Check } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { calculateProductPrice } from "@/features/product/lib/calculate-product-price"
import { useAddToCartToast } from "@/features/cart/hooks/use-add-to-cart-toast"
import type { ProductVariation } from "@/types/woocommerce"
import { ProductPriceBox } from "./product-price-box"
import { ProductActions } from "./product-actions"
import { ProductVariantSelector, type VariantAttribute } from "./product-variant-selector"

interface ProductInfoProps {
  id: number
  name: string
  sku: string
  brand: string
  categoryName: string
  price: string
  regularPrice: string
  salePrice: string
  onSale: boolean
  type: "simple" | "variable" | "grouped" | "external"
  image?: string
  stockStatus: string
  stockQuantity: number | null
  totalSales: number
  averageRating: string
  ratingCount: number
  whatsappNumber: string
  variantAttributes: VariantAttribute[]
  variations: ProductVariation[]
}

export function ProductInfo({
  id,
  name,
  sku,
  brand,
  categoryName,
  price,
  regularPrice,
  salePrice,
  onSale,
  type,
  image,
  stockStatus,
  stockQuantity,
  totalSales,
  averageRating,
  ratingCount,
  whatsappNumber,
  variantAttributes,
  variations,
}: ProductInfoProps) {
  const isSimpleProduct = type === "simple"
  const hasVariants = type === "variable" && variantAttributes.length > 0 && variations.length > 0

  const addItem = useCartStore((state) => state.addItem)
  const { isLoggedIn } = useAuthStore()
  const showAddToCartToast = useAddToCartToast()
  const mounted = useIsHydrated()

  const [selected, setSelected] = useState<Record<string, string>>({})

  const isMember = mounted && isLoggedIn

  // Varian yang cocok dengan kombinasi pilihan saat ini — undefined selama
  // belum semua atribut dipilih, atau kombinasinya memang tidak ada.
  const resolvedVariation = hasVariants
    ? variations.find((variation) =>
        variantAttributes.every((attr) => {
          const chosen = selected[attr.name]
          if (!chosen) return false
          const match = variation.attributes.find(
            (a) => a.name.trim().toLowerCase() === attr.name.trim().toLowerCase()
          )
          return match?.option.trim().toLowerCase() === chosen.trim().toLowerCase()
        })
      )
    : undefined

  const effectivePrice = resolvedVariation?.price ?? price
  const effectiveRegularPrice = resolvedVariation?.regular_price ?? regularPrice
  const effectiveSalePrice = resolvedVariation?.sale_price ?? salePrice
  const effectiveOnSale = resolvedVariation?.on_sale ?? onSale
  const effectiveSku = resolvedVariation?.sku || sku
  const effectiveImage = resolvedVariation?.image?.src || image

  const {
    displayPrice,
    displayRegular,
    displaySale,
    baseFinalPrice,
    memberPrice,
    finalPrice,
    discountPercent,
  } = calculateProductPrice({
    price: effectivePrice,
    regularPrice: effectiveRegularPrice,
    salePrice: effectiveSalePrice,
    onSale: effectiveOnSale,
    isMember,
  })

  const canAddToCart = isSimpleProduct
    ? stockStatus === "instock"
    : hasVariants && resolvedVariation?.stock_status === "instock"

  const showCartButton = isSimpleProduct || hasVariants

  const addToCartHint = isSimpleProduct
    ? undefined
    : !hasVariants
      ? "Produk ini memiliki beberapa varian — hubungi kami via WhatsApp untuk pilihan yang tersedia."
      : !resolvedVariation
        ? "Pilih semua opsi di atas untuk melihat harga & stok."
        : resolvedVariation.stock_status !== "instock"
          ? "Varian ini sedang habis."
          : undefined

  const waLabel = canAddToCart ? "Beli via WhatsApp" : "Tanya via WhatsApp"

  const variantSuffix =
    type === "variable" && Object.keys(selected).length > 0
      ? ` (${variantAttributes.map((a) => `${a.name}: ${selected[a.name] ?? "?"}`).join(", ")})`
      : ""
  const waMessage = `Halo HNS IT Center, saya tertarik dengan produk: ${name}${variantSuffix} (SKU: ${effectiveSku}). Apakah tersedia?`
  const waUrl = buildWhatsAppUrl(whatsappNumber, waMessage)

  const handleSelectVariant = (attributeName: string, option: string) => {
    setSelected((prev) => ({ ...prev, [attributeName]: option }))
  }

  const handleAddToCart = () => {
    if (type === "variable") {
      if (!resolvedVariation) return
      const variantLabel = variantAttributes.map((a) => selected[a.name]).join(", ")
      addItem({
        id: `${id}_${resolvedVariation.id}`,
        productId: id,
        name,
        price: finalPrice,
        quantity: 1,
        sku: effectiveSku,
        image: effectiveImage,
        variationLabel: variantLabel,
      })
      showAddToCartToast(name)
      return
    }

    addItem({
      id: id.toString(),
      productId: id,
      name,
      price: finalPrice,
      quantity: 1,
      sku,
      image,
    })
    showAddToCartToast(name)
  }

  return (
    <div className="space-y-6">
      {/* Brand + Category */}
      <div className="flex items-center gap-2 text-sm">
        {brand && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {brand}
          </span>
        )}
        <span className="text-muted-foreground">{categoryName}</span>
      </div>

      {/* Product Name */}
      <h1 className="text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
        {name}
      </h1>

      {/* SKU + Sold + Rating */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {effectiveSku && <span>SKU: {effectiveSku}</span>}
        <span>•</span>
        <span>Terjual {totalSales}+</span>
        {ratingCount > 0 && (
          <>
            <span>•</span>
            <span>⭐ {averageRating} ({ratingCount} ulasan)</span>
          </>
        )}
      </div>

      <ProductPriceBox
        isMember={isMember}
        mounted={mounted}
        memberPrice={memberPrice}
        baseFinalPrice={baseFinalPrice}
        onSale={effectiveOnSale}
        displaySale={displaySale}
        discountPercent={discountPercent}
        displayRegular={displayRegular}
        displayPrice={displayPrice}
      />

      {hasVariants && (
        <ProductVariantSelector
          attributes={variantAttributes}
          selected={selected}
          onSelect={handleSelectVariant}
        />
      )}

      {/* Stock Status */}
      <div className="flex items-center gap-2">
        {isSimpleProduct ? (
          stockStatus === "instock" ? (
            <>
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-success">
                Tersedia
                {stockQuantity != null && stockQuantity <= 5 && ` (Sisa ${stockQuantity})`}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-sale-red">Stok Habis</span>
          )
        ) : !hasVariants ? null : !resolvedVariation ? (
          <span className="text-sm text-muted-foreground">Pilih varian untuk melihat ketersediaan stok</span>
        ) : resolvedVariation.stock_status === "instock" ? (
          <>
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm font-semibold text-success">
              Tersedia
              {resolvedVariation.stock_quantity != null &&
                resolvedVariation.stock_quantity <= 5 &&
                ` (Sisa ${resolvedVariation.stock_quantity})`}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-sale-red">Stok Habis</span>
        )}
      </div>

      <ProductActions
        onAddToCart={handleAddToCart}
        canAddToCart={canAddToCart}
        showCartButton={showCartButton}
        addToCartHint={addToCartHint}
        waUrl={waUrl}
        waLabel={waLabel}
        price={finalPrice}
      />
      {/* Spacer: ProductActions jadi fixed di mobile, sisakan ruang agar
          konten di bawahnya (trust badge, tabs, footer) tidak tertutup. */}
      <div className="h-20 md:hidden" aria-hidden="true" />

      {/* Trust Badges */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Shield className="h-5 w-5 text-brand-green shrink-0" />
          <span>Garansi Resmi</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Truck className="h-5 w-5 text-brand-green shrink-0" />
          <span>
            Gratis ongkir Batam (syarat berlaku) —{" "}
            <a href="/kebijakan/pengiriman" className="underline hover:text-brand-green">
              lihat kebijakan
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}
