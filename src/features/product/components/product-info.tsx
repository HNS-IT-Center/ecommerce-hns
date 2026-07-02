"use client"

import { ShoppingCart, MessageCircle, Shield, Truck, Check, Lock } from "lucide-react"
import { formatRupiah } from "@/lib/utils"

interface ProductInfoProps {
  name: string
  sku: string
  brand: string
  categoryName: string
  price: string
  regularPrice: string
  salePrice: string
  onSale: boolean
  stockStatus: string
  stockQuantity: number | null
  totalSales: number
  averageRating: string
  ratingCount: number
  whatsappNumber?: string
}

export function ProductInfo({
  name,
  sku,
  brand,
  categoryName,
  price,
  regularPrice,
  salePrice,
  onSale,
  stockStatus,
  stockQuantity,
  totalSales,
  averageRating,
  ratingCount,
  whatsappNumber = "6281170000000",
}: ProductInfoProps) {
  const displayPrice = parseInt(price || "0", 10)
  const displayRegular = parseInt(regularPrice || price || "0", 10)
  const displaySale = salePrice ? parseInt(salePrice, 10) : null

  const isInStock = stockStatus === "instock"

  // Calculate discount percentage
  const discountPercent =
    onSale && displaySale && displayRegular > 0
      ? Math.round(((displayRegular - displaySale) / displayRegular) * 100)
      : 0

  const waMessage = `Halo HNS IT Center, saya tertarik dengan produk: ${name} (SKU: ${sku}). Apakah tersedia?`
  const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMessage)}`

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

      {/* Price Box */}
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        {onSale && displaySale ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-sale-red">
                {formatRupiah(displaySale)}
              </span>
              {discountPercent > 0 && (
                <span className="rounded-md bg-sale-red/10 px-2 py-0.5 text-sm font-bold text-sale-red">
                  -{discountPercent}%
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground line-through">
              {formatRupiah(displayRegular)}
            </div>
          </>
        ) : (
          <span className="text-3xl font-extrabold text-foreground">
            {formatRupiah(displayPrice)}
          </span>
        )}
        
        {/* Member Price Hint */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-green/10 px-3 py-2 text-sm">
          <Lock className="h-4 w-4 text-brand-green" />
          <span>
            <a href="/login" className="font-semibold text-brand-green hover:underline">Login</a>
            {" "}untuk melihat harga member eksklusif
          </span>
        </div>
      </div>

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

      {/* CTA Buttons */}
      <div className="flex flex-col gap-3">
        <button
          disabled={!isInStock}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-background font-bold transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingCart className="h-5 w-5" />
          Tambah ke Keranjang
        </button>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white transition-colors hover:bg-[#25D366]/90"
        >
          <MessageCircle className="h-5 w-5" />
          Beli via WhatsApp
        </a>
      </div>

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
