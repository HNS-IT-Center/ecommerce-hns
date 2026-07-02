import Image from "next/image"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"

import { formatRupiah } from "@/lib/utils"

export interface Product {
  id: string
  slug: string
  name: string
  brand: string
  category: string
  price: number
  member_price?: number
  image_url: string
  sold: number
  badge?: "Hot" | "Deal" | "New" | null
  stock: number
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const hasMemberPrice = product.member_price != null && product.member_price < product.price

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-ring"
    >
      {/* Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/50">
        <Image
          src={product.image_url}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Badge */}
        {product.badge && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-sale-red px-2 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm">
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

        <div className="mt-auto pt-4">
          {/* Normal Price */}
          <div className="text-lg font-bold text-sale-red">
            {formatRupiah(product.price)}
          </div>
          
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
              Terjual {product.sold}+
            </span>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-brand-green group-hover:text-white" aria-label="Add to cart">
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
