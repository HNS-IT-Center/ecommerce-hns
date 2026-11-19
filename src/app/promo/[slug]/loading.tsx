import { ProductGridSkeleton } from "@/components/ui/product-grid-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6">
      <Skeleton className="aspect-[2/1] w-full rounded-3xl" />
      <Skeleton className="mt-4 h-40 w-full rounded-2xl" />
      <div className="mt-9">
        <ProductGridSkeleton />
      </div>
    </div>
  )
}
