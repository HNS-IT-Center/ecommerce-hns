import { Skeleton } from "@/components/ui/skeleton"
import { ProductGridSkeleton } from "@/components/ui/product-grid-skeleton"

export function ShopPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-50 h-16 w-full border-b bg-background" />
      <main className="flex-1 bg-muted/20 py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>

          <div className="flex flex-col gap-8 md:flex-row">
            {/* Sidebar Desktop */}
            <div className="hidden w-64 shrink-0 md:block">
              <div className="space-y-3 pr-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1">
              <ProductGridSkeleton
                count={15}
                className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
