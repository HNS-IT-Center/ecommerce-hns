import { Skeleton } from "@/components/ui/skeleton"
import { ProductGridSkeleton } from "@/components/ui/product-grid-skeleton"

type SectionSkeletonProps = {
  count?: number
}

export function SectionSkeleton({ count = 4 }: SectionSkeletonProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <Skeleton className="mb-8 h-8 w-48" />
      <ProductGridSkeleton count={count} />
    </section>
  )
}
