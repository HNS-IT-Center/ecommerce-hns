"use client"

import { useMemo, useState } from "react"
import { ArrowUpDown } from "lucide-react"

import { ProductCard, type Product } from "@/components/ui/product-card"
import { catalogDiscountPercent } from "@/lib/utils/product"
import { cn } from "@/lib/utils"

type SortKey = "default" | "discount" | "price-asc" | "price-desc"

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Rekomendasi" },
  { value: "discount", label: "Diskon terbesar" },
  { value: "price-asc", label: "Harga terendah" },
  { value: "price-desc", label: "Harga tertinggi" },
]

const ALL = "Semua"

/**
 * Daftar produk promo dengan saringan kategori dan urutan — semuanya di klien,
 * karena daftarnya pendek (pilihan staff) dan sudah lengkap di tangan.
 *
 * Tidak ada angka harga yang dihitung di sini (CLAUDE.md §2.7). Urutan
 * "Diskon terbesar" memakai `catalogDiscountPercent`, keterangan yang sama
 * dengan lencana di kartu.
 */
export function PromoProductGrid({ products }: { products: Product[] }) {
  const [category, setCategory] = useState(ALL)
  const [sort, setSort] = useState<SortKey>("default")

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const product of products) {
      if (product.category) counts.set(product.category, (counts.get(product.category) ?? 0) + 1)
    }
    return [...counts.entries()]
  }, [products])

  const visible = useMemo(() => {
    const filtered = category === ALL ? products : products.filter((p) => p.category === category)
    const sorted = [...filtered]
    if (sort === "discount") {
      sorted.sort((a, b) => (catalogDiscountPercent(b) ?? 0) - (catalogDiscountPercent(a) ?? 0))
    } else if (sort === "price-asc") {
      sorted.sort((a, b) => a.price - b.price)
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => b.price - a.price)
    }
    // Yang habis selalu di belakang, apa pun urutannya — `sort` stabil, jadi
    // urutan di antara sesamanya tetap.
    return sorted.sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0))
  }, [products, category, sort])

  return (
    <>
      {/* `top-16` = tinggi header yang `fixed` (lihat header-shell.tsx). */}
      <div className="sticky top-16 z-20 -mx-4 flex items-center gap-2.5 bg-page/90 px-4 py-2.5 backdrop-blur md:-mx-6 md:px-6">
        {categories.length > 1 && (
          <div
            role="group"
            aria-label="Saring kategori"
            className="flex min-w-0 flex-1 gap-2 overflow-x-auto pr-6 [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none] md:[mask-image:none] [&::-webkit-scrollbar]:hidden"
          >
            {[[ALL, products.length] as const, ...categories].map(([name, count]) => {
              const active = category === name
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(name)}
                  className={cn(
                    "inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/70 bg-card hover:border-primary"
                  )}
                >
                  {name}
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      active ? "text-background/60" : "text-muted-foreground/60"
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <label className="relative ml-auto shrink-0">
          <span className="sr-only">Urutkan produk</span>
          <ArrowUpDown
            className="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 sm:hidden"
            aria-hidden="true"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8.5 w-10 cursor-pointer appearance-none rounded-full border border-border/70 bg-card text-[13px] text-transparent sm:w-auto sm:px-3.5 sm:text-foreground"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value} className="text-foreground">
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </>
  )
}
