"use client"

import Link from "next/link"
import Image from "next/image"
import { Check } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { BuilderProduct } from "@/store/new-builder"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ProductCardBuilderProps {
  product: BuilderProduct
  isSelected: boolean
  onSelect: () => void
  displayAttributeIds: number[]
}

export function ProductCardBuilder({ product, isSelected, onSelect, displayAttributeIds }: ProductCardBuilderProps) {
  // Show only attributes that are required by the builder configuration across all steps
  const displayAttributes = product.attributes.filter(attr => displayAttributeIds.includes(attr.attributeId))

  const hasDiscount = Boolean(product.regularPrice && product.salePrice && product.regularPrice > product.salePrice)
  const discountPercent = hasDiscount
    ? Math.round((1 - product.salePrice! / product.regularPrice!) * 100)
    : 0

  return (
    <div className={`group relative flex flex-col rounded-xl bg-card shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isSelected ? 'ring-2 ring-brand-green' : ''}`}>
      {/* Folded Discount Badge */}
      {hasDiscount && (
        <div className="absolute -left-1.5 top-3 z-[40] drop-shadow-sm pointer-events-none">
          <div className="rounded-r-md rounded-tl-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white tracking-wide">
            {discountPercent}%
          </div>
          <div 
             className="h-1.5 w-1.5 bg-red-800" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} 
          />
        </div>
      )}

      {/* Image Container */}
      <Link href={`/product/${product.slug}`} target="_blank" className="relative aspect-square w-full overflow-hidden bg-secondary/50 rounded-t-xl group/image block">
        <Image
          src={product.image || "/placeholder.jpg"}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Out of Stock Overlay */}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
            <span className="rounded-full bg-foreground px-3 py-1 text-xs font-bold text-background shadow-sm">
              HABIS
            </span>
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-3 rounded-b-xl">
        {/* Badges for Required Attributes */}
        {displayAttributes.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {displayAttributes.map((attr, idx) => (
              <Badge key={idx} variant="secondary" className="text-[8px] px-1.5 py-0 font-medium bg-red-600 text-white hover:bg-red-700">
                {attr.valueName}
              </Badge>
            ))}
          </div>
        )}

        {/* Product Name */}
        <Link href={`/product/${product.slug}`} target="_blank">
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
            {product.name}
          </h3>
        </Link>

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
              {formatRupiah(product.regularPrice!)}
            </div>
          )}

          {/* Footer of Card: Sold count and Button */}
          <div className="mt-2 flex items-center justify-between pt-2">
            <span className="text-[10px] text-muted-foreground">
              {product.sold > 0 ? `Dilihat ${product.sold}+` : ""}
            </span>
            <Button 
              size="sm"
              onClick={onSelect}
              className={`h-7 px-3 text-[10px] font-bold rounded-full transition-all duration-300 cursor-pointer ${
                isSelected 
                  ? "bg-brand-green hover:bg-brand-green/90 text-white shadow-md shadow-brand-green/20" 
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Selected
                </>
              ) : (
                "Select"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
