"use client"

import Image from "next/image"
import { Minus, Plus } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { BuilderProduct } from "@/store/new-builder"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ProductCardBuilderProps {
  product: BuilderProduct
  quantity: number
  onSelect: () => void
  onUpdateQuantity: (quantity: number) => void
  displayAttributeIds: number[]
}

export function ProductCardBuilder({ product, quantity, onSelect, onUpdateQuantity, displayAttributeIds }: ProductCardBuilderProps) {
  // Show only attributes that are required by the builder configuration across all steps
  const displayAttributes = product.attributes.filter(attr => displayAttributeIds.includes(attr.attributeId))

  const hasDiscount = Boolean(product.regularPrice && product.salePrice && product.regularPrice > product.salePrice)
  const discountPercent = hasDiscount
    ? Math.round((1 - product.salePrice! / product.regularPrice!) * 100)
    : 0
    
  const isSelected = quantity > 0

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
      <button 
        type="button" 
        onClick={product.stock > 0 ? onSelect : undefined} 
        className="relative aspect-square w-full overflow-hidden bg-secondary/50 rounded-t-xl group/image block text-left"
        disabled={product.stock === 0}
      >
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
      </button>

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
        <button 
          type="button" 
          onClick={product.stock > 0 ? onSelect : undefined} 
          className="text-left"
          disabled={product.stock === 0}
        >
          <h3 className="line-clamp-2 text-xs font-medium leading-snug text-foreground transition-colors group-hover:text-brand-green">
            {product.name}
          </h3>
        </button>

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

          {/* Footer of Card: Button or Quantity Control */}
          <div className="mt-3 flex items-center justify-end">
            {isSelected ? (
              <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-full border border-border/50 shadow-sm">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-full bg-background hover:bg-red-100 hover:text-red-600 shadow-sm"
                  onClick={() => onUpdateQuantity(quantity - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-xs font-bold w-4 text-center">{quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-full bg-background hover:bg-brand-green/20 hover:text-brand-green shadow-sm"
                  onClick={() => onUpdateQuantity(quantity + 1)}
                  disabled={quantity >= product.stock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button 
                size="sm"
                onClick={onSelect}
                disabled={product.stock === 0}
                className="h-7 px-4 text-[10px] font-bold rounded-full transition-all duration-300 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
              >
                Select
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

