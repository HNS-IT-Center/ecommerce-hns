"use client"

import { Shield, Truck, Check } from "lucide-react"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"
import { useCartStore } from "@/store/cart"
import { useAuthStore } from "@/store/auth"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { calculateProductPrice } from "@/features/product/lib/calculate-product-price"
import { useAddToCartToast } from "@/features/cart/hooks/use-add-to-cart-toast"
import { ProductPriceBox } from "./product-price-box"
import { ProductActions } from "./product-actions"

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
  image?: string
  stockStatus: string
  stockQuantity: number | null
  totalSales: number
  averageRating: string
  ratingCount: number
  whatsappNumber: string
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
  image,
  stockStatus,
  stockQuantity,
  totalSales,
  averageRating,
  ratingCount,
  whatsappNumber,
}: ProductInfoProps) {
  const addItem = useCartStore((state) => state.addItem)
  const { isLoggedIn } = useAuthStore()
  const showAddToCartToast = useAddToCartToast()
  const mounted = useIsHydrated()

  const isInStock = stockStatus === "instock"
  const isMember = mounted && isLoggedIn

  const {
    displayPrice,
    displayRegular,
    displaySale,
    baseFinalPrice,
    memberPrice,
    finalPrice,
    discountPercent,
  } = calculateProductPrice({ price, regularPrice, salePrice, onSale, isMember })

  const waMessage = `Halo HNS IT Center, saya tertarik dengan produk: ${name} (SKU: ${sku}). Apakah tersedia?`
  const waUrl = buildWhatsAppUrl(whatsappNumber, waMessage)

  const handleAddToCart = () => {
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
        {sku && <span>SKU: {sku}</span>}
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
        onSale={onSale}
        displaySale={displaySale}
        discountPercent={discountPercent}
        displayRegular={displayRegular}
        displayPrice={displayPrice}
      />

      {/* Stock Status */}
      <div className="flex items-center gap-2">
        {isInStock ? (
          <>
            <Check className="h-4 w-4 text-brand-green" />
            <span className="text-sm font-semibold text-brand-green">
              Tersedia
              {stockQuantity != null && stockQuantity <= 5 && ` (Sisa ${stockQuantity})`}
            </span>
          </>
        ) : (
          <span className="text-sm font-semibold text-sale-red">Stok Habis</span>
        )}
      </div>

      <ProductActions onAddToCart={handleAddToCart} isInStock={isInStock} waUrl={waUrl} />

      {/* Trust Badges */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Shield className="h-5 w-5 text-brand-green shrink-0" />
          <span>Garansi Resmi</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <Truck className="h-5 w-5 text-brand-green shrink-0" />
          <span>Gratis Ongkir Batam</span>
        </div>
      </div>
    </div>
  )
}
