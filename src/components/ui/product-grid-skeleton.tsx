import { ProductCardSkeleton } from "@/components/ui/product-card-skeleton"

type ProductGridSkeletonProps = {
  count?: number
  className?: string
}

export function ProductGridSkeleton({ count = 4, className }: ProductGridSkeletonProps) {
  return (
    <div className={className ?? "grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6"}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
