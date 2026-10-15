import { ProductImage } from "@/components/ui/product-image"
import Link from "next/link"

import { formatRupiah } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { catalogDiscountPercent } from "@/lib/utils/product"
import { Skeleton } from "@/components/ui/skeleton"
import type { Product } from "@/components/ui/product-card"
import type { LiveSearchStatus } from "@/features/search/hooks/use-live-search"

type SearchResultsDropdownProps = {
  id: string
  status: LiveSearchStatus
  results: Product[]
  query: string
  highlightedIndex: number
  onHoverIndex: (index: number) => void
  onSelect: () => void
  getOptionId: (index: number) => string
  className?: string
}

/** Tebalkan bagian nama produk yang cocok dengan query pencarian. */
function highlightMatch(text: string, query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{text}</>

  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = terms.some(t => t.toLowerCase() === part.toLowerCase())
        if (isMatch) {
          return <strong key={i} className="font-bold text-foreground">{part}</strong>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

/**
 * Harga satu hasil pencarian. Merah HANYA untuk barang yang sedang diskon —
 * dulu semua harga merah, sehingga warnanya tidak memberi tahu apa-apa dan
 * diskon tidak terlihat sama sekali.
 *
 * Harga coret tidak dipasang di samping rentang harga produk bervarian: satu
 * angka tercoret di sebelah "Rp X – Rp Y" tidak jelas milik ujung yang mana.
 * Badge persennya tetap tampil.
 */
function SearchResultPrice({ product }: { product: Product }) {
  const { price, price_max: priceMax, regular_price: regularPrice } = product
  const discountPercent = catalogDiscountPercent(product)

  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span
        className={cn("font-semibold", discountPercent !== null ? "text-sale-red" : "text-foreground")}
      >
        {priceMax != null
          ? `${formatRupiah(price)} – ${formatRupiah(priceMax)}`
          : formatRupiah(price)}
      </span>
      {discountPercent !== null && priceMax == null && regularPrice != null && (
        <span className="text-xs text-muted-foreground line-through">
          {formatRupiah(regularPrice)}
        </span>
      )}
      {discountPercent !== null && (
        <span className="rounded bg-sale-red/10 px-1 py-0.5 text-[10px] font-bold text-sale-red">
          -{discountPercent}%
        </span>
      )}
    </p>
  )
}

export function SearchResultsDropdown({
  id,
  status,
  results,
  query,
  highlightedIndex,
  onHoverIndex,
  onSelect,
  getOptionId,
  className,
}: SearchResultsDropdownProps) {
  return (
    <div
      id={id}
      role="listbox"
      onMouseLeave={() => onHoverIndex(-1)}
      className={cn(
        "absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border bg-popover text-popover-foreground shadow-lg",
        className
      )}
    >
      {status === "loading" && (
        <div className="flex flex-col gap-2 p-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="p-4 text-center text-sm text-muted-foreground">
          Produk tidak ditemukan.
        </p>
      )}

      {status === "error" && (
        <p className="p-4 text-center text-sm text-muted-foreground">
          Gagal mencari produk. Coba lagi.
        </p>
      )}

      {status === "success" && results.length > 0 && (
        <ul>
          {results.map((product, index) => (
            <li
              key={product.id}
              id={getOptionId(index)}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              <Link
                href={`/product/${product.slug}`}
                onClick={onSelect}
                onMouseEnter={() => onHoverIndex(index)}
                className={cn(
                  "flex items-center gap-3 p-3 transition-colors",
                  index === highlightedIndex ? "bg-muted" : "hover:bg-muted"
                )}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white">
                  <ProductImage
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">
                    {highlightMatch(product.name, query)}
                  </p>
                  <SearchResultPrice product={product} />
                </div>
              </Link>
            </li>
          ))}
          <li className="sticky bottom-0 z-10 bg-popover border-t">
            <Link 
              href={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={onSelect}
              className="flex w-full items-center justify-center p-3 text-sm font-semibold text-sale-red hover:bg-muted/50 transition-colors"
            >
              Lihat semua hasil untuk &quot;{query}&quot;
            </Link>
          </li>
        </ul>
      )}
    </div>
  )
}
