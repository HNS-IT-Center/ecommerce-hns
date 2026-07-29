"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, ShoppingCart, Percent } from "lucide-react"
import WhatsappIcon from "@/components/icons/whatsapp-icon"
import FlameIcon from "@/components/icons/fire-icon"
import { buildWhatsAppUrl } from "@/lib/api/whatsapp"

import { formatRupiah } from "@/lib/utils"
import { getBadgeColorClass } from "@/lib/utils/product"
import { useCartStore } from "@/store/cart"
import { Rating } from "@/components/ui/rating"
import { useFlyToCart } from "@/components/providers/fly-to-cart-provider"
import { useState } from "react"

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
  const { flyToCart, showCartToast } = useFlyToCart()
  const [isAdding, setIsAdding] = useState(false)

  const hasMemberPrice = product.member_price != null && product.member_price < product.price
  const isSimpleProduct = product.type === "simple"
  const hasDiscount =
    product.on_sale && product.regular_price != null && product.regular_price > product.price
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.regular_price!) * 100)
    : 0

  const productUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/product/${product.slug}`
    : `${process.env.NEXT_PUBLIC_SITE_URL || 'https://hnsitcenter.id'}/product/${product.slug}`

  const waMessage = `${productUrl}

Hallo Saya ingin menanyakan soal Product ${product.name} dengan harga ${formatRupiah(hasDiscount ? product.regular_price! : product.price)}${hasDiscount ? ` dengan harga discount ${formatRupiah(product.price)}` : ""}`

  const handleAddToCart = (event: React.MouseEvent) => {
    if (isAdding) return

    if (!isSimpleProduct) {
      router.push(`/product/${product.slug}`)
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setIsAdding(true)
    
    flyToCart(event.clientX, event.clientY, product.image_url)
    
    setTimeout(() => {
      addItem({
        id: product.id,
        productId: Number(product.id),
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.image_url,
      })
      setIsAdding(false)
      showCartToast()
    }, 800)
  }

  return (
    <div className="group relative flex flex-col rounded-xl bg-card shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <Link
        href={`/product/${product.slug}`}
        className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="sr-only">{product.name}</span>
      </Link>

      {/* Folded Discount Badge */}
      {hasDiscount && (
        <div className="absolute -left-1.5 top-3 z-20 drop-shadow-sm">
          <div className="rounded-r-md rounded-tl-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white tracking-wide">
            {discountPercent}%
          </div>
          <div 
             className="h-1.5 w-1.5 bg-red-800" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} 
          />
        </div>
      )}

      {/* Hot Badge Folded (when not on sale) */}
      {!hasDiscount && product.badge === "Hot" && (
        <div className="absolute -left-1.5 top-3 z-20 drop-shadow-sm">
          <div className="flex items-center gap-0.5 rounded-r-md rounded-tl-md bg-orange-500 px-1.5 py-0.5 text-xs font-bold text-white tracking-wide">
            <FlameIcon size={14} className="text-white" />
            HOT
          </div>
          <div 
             className="h-1.5 w-1.5 bg-orange-800" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} 
          />
        </div>
      )}

      {/* Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/50 rounded-t-xl">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain transition-transform duration-500 group-hover:scale-105"
        />
        


        {/* Regular Badge */}
        {!hasDiscount && product.badge && product.badge !== "Hot" && (
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
      <div className="flex flex-1 flex-col p-3 rounded-b-xl">
        {/* Brand */}
        <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          {product.brand}
        </span>
        
        {/* Product Name */}
        <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
          {product.name}
        </h3>

        {/* Rating */}
        {!!product.rating_count && (
          <Rating value={product.average_rating ?? 0} count={product.rating_count} className="mt-1" />
        )}

        <div className="mt-auto pt-3">
          {/* Price + Discount */}
          {hasDiscount ? (
            <div className="flex items-baseline gap-1.5">
              <div className="text-sm font-bold text-red-500">
                {formatRupiah(product.price)}
              </div>
              <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-bold text-red-500">
                -{discountPercent}%
              </span>
            </div>
          ) : (
            <div className="text-sm font-bold text-foreground">
              {formatRupiah(product.price)}
            </div>
          )}
          {hasDiscount && (
            <div className="text-[10px] text-muted-foreground line-through">
              {formatRupiah(product.regular_price!)}
            </div>
          )}

          {/* Member Price */}
          {hasMemberPrice && (
            <div className="mt-0.5 text-[10px] font-medium text-foreground">
              Member: <span className="font-bold">{formatRupiah(product.member_price!)}</span>
            </div>
          )}

          {/* Footer of Card: Sold count and Cart icon */}
          <div className="mt-2 flex items-center justify-between pt-2">
            <span className="text-[10px] text-muted-foreground">
              {product.sold > 0 ? `Terjual ${product.sold}+` : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <a 
                href={buildWhatsAppUrl(process.env.NEXT_PUBLIC_WHATSAPP_CS_NUMBER || "", waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                title="Pesan via WhatsApp"
                className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366] transition-all duration-300 ease-in-out hover:bg-[#25D366]/20 hover:scale-110 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <WhatsappIcon size={14} />
              </a>
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                title={isSimpleProduct ? "Tambah ke keranjang" : "Pilih varian"}
                className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground transition-all duration-300 ease-in-out group-hover:bg-brand-green group-hover:text-white cursor-pointer hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isSimpleProduct ? "Tambah ke keranjang" : "Lihat pilihan varian"}
              >
                {isSimpleProduct ? (
                  <ShoppingCart className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
