"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ShoppingCart, ArrowRight } from "lucide-react"

import { formatRupiah } from "@/lib/utils"
import { getBadgeColorClass } from "@/lib/utils/product"
import { useCartStore } from "@/store/cart"
import { useAddToCartToast } from "@/features/cart/hooks/use-add-to-cart-toast"
import { Rating } from "@/components/ui/rating"

export interface Product {
  id: string
  slug: string
  name: string
  brand: string
  category: string
  price: number
  regular_price?: number
  on_sale?: boolean
  member_price?: number
  image_url: string
  sold: number
  badge?: "Hot" | "Deal" | "New" | null
  stock: number
  type: "simple" | "variable" | "grouped" | "external"
  average_rating?: number
  rating_count?: number
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const addItem = useCartStore((state) => state.addItem)
  const showAddToCartToast = useAddToCartToast()
  const hasMemberPrice = product.member_price != null && product.member_price < product.price
  const isSimpleProduct = product.type === "simple"
  const hasDiscount =
    product.on_sale && product.regular_price != null && product.regular_price > product.price
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.regular_price!) * 100)
    : 0

  const handleAddToCart = (event: React.MouseEvent) => {
    // Tombol ini sekarang sibling dari overlay Link (bukan bersarang di
    // dalamnya, lihat I-12), jadi klik tidak lagi "jatuh" ke Link secara
    // alami — produk bervarian perlu navigasi eksplisit supaya user pilih
    // varian dulu (hindari order ambigu ke CS).
    if (!isSimpleProduct) {
      router.push(`/product/${product.slug}`)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    addItem({
      id: product.id,
      productId: Number(product.id),
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image_url,
    })
    showAddToCartToast(product.name)
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/product/${product.slug}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="sr-only">{product.name}</span>
      </Link>

      {/* Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/50">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain p-2 transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Badge */}
        {product.badge && (
          <span
            className={`absolute left-2 top-2 z-10 rounded-md px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm ${getBadgeColorClass(product.badge)}`}
          >
            {product.badge}
          </span>
        )}
        
        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background shadow-sm">
              HABIS
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        {/* Brand */}
        <span className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {product.brand}
        </span>
        
        {/* Product Name */}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
          {product.name}
        </h3>

        {/* Rating */}
        {!!product.rating_count && (
          <Rating value={product.average_rating ?? 0} count={product.rating_count} className="mt-1" />
        )}

        <div className="mt-auto pt-4">
          {/* Price + Discount */}
          {hasDiscount ? (
            <div className="flex items-baseline gap-2">
              <div className="text-lg font-bold text-foreground">
                {formatRupiah(product.price)}
              </div>
              <span className="rounded bg-sale-red/10 px-1.5 py-0.5 text-[10px] font-bold text-sale-red">
                -{discountPercent}%
              </span>
            </div>
          ) : (
            <div className="text-lg font-bold text-foreground">
              {formatRupiah(product.price)}
            </div>
          )}
          {hasDiscount && (
            <div className="text-xs text-muted-foreground line-through">
              {formatRupiah(product.regular_price!)}
            </div>
          )}

          {/* Member Price */}
          {hasMemberPrice ? (
            <div className="mt-0.5 text-xs font-medium text-foreground">
              Member: <span className="font-bold">{formatRupiah(product.member_price!)}</span>
            </div>
          ) : (
            <div className="mt-0.5 text-xs font-medium text-muted-foreground">
              Daftar member untuk harga khusus
            </div>
          )}

          {/* Footer of Card: Sold count and Cart icon */}
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-[11px] text-muted-foreground">
              {product.sold > 0 ? `Terjual ${product.sold}+` : ""}
            </span>
            <button
              onClick={handleAddToCart}
              title={isSimpleProduct ? "Tambah ke keranjang" : "Pilih varian"}
              className="relative z-20 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-brand-green group-hover:text-white"
              aria-label={isSimpleProduct ? "Tambah ke keranjang" : "Lihat pilihan varian"}
            >
              {isSimpleProduct ? (
                <ShoppingCart className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
