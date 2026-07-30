"use client"

import Image from "next/image"
import { Check, ShoppingBag } from "lucide-react"
import { formatRupiah } from "@/lib/utils"
import { BuilderProduct } from "@/store/new-builder"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ProductCardBuilderProps {
  product: BuilderProduct
  isSelected: boolean
  onSelect: () => void
}

export function ProductCardBuilder({ product, isSelected, onSelect }: ProductCardBuilderProps) {
  // Show max 3 attributes as badges
  const displayAttributes = product.attributes.slice(0, 3)

  return (
    <div 
      className={`group relative flex flex-col rounded-2xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-lg ${
        isSelected ? "border-brand-green ring-1 ring-brand-green" : "border-border/50 hover:border-primary/50"
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-square w-full bg-muted/20 p-4">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-4 mix-blend-multiply"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        
        {/* Selected Overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-brand-green/10 flex flex-col items-center justify-center backdrop-blur-[1px]">
            <div className="bg-brand-green text-white p-3 rounded-full shadow-lg">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 pt-3">
        {/* Badges */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {displayAttributes.map((attr, idx) => (
            <Badge key={idx} variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
              {attr.valueName}
            </Badge>
          ))}
        </div>

        <h3 className="line-clamp-2 text-sm font-semibold text-foreground mb-1 leading-snug">
          {product.name}
        </h3>
        
        <div className="mt-auto pt-3">
          <p className="text-lg font-black text-foreground mb-3">
            {formatRupiah(product.price)}
          </p>
          
          <Button 
            onClick={onSelect}
            className={`w-full rounded-xl font-bold h-10 ${
              isSelected 
                ? "bg-brand-green hover:bg-brand-green/90 text-white shadow-md shadow-brand-green/20" 
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
            }`}
          >
            {isSelected ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Selected
              </>
            ) : (
              "Select & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
