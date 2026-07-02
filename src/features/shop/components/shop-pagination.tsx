import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface ShopPaginationProps {
  currentPage: number
  totalPages: number
  basePath: string
}

export function ShopPagination({ currentPage, totalPages, basePath }: ShopPaginationProps) {
  if (totalPages <= 1) return null

  const pages: (number | "...")[] = []
  
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push("...")
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push("...")
    pages.push(totalPages)
  }

  const separator = basePath.includes("?") ? "&" : "?"

  return (
    <nav className="mt-10 flex items-center justify-center gap-1" aria-label="Pagination">
      {currentPage > 1 ? (
        <Link
          href={`${basePath}${separator}page=${currentPage - 1}`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-muted"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm text-muted-foreground opacity-50">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`dots-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={`${basePath}${separator}page=${page}`}
            className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-brand-green text-white"
                : "border border-border hover:bg-muted"
            }`}
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link
          href={`${basePath}${separator}page=${currentPage + 1}`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-muted"
          aria-label="Halaman selanjutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm text-muted-foreground opacity-50">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
