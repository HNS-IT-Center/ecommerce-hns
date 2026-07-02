"use client"

import { useState } from "react"
import { SlidersHorizontal, X, ChevronDown } from "lucide-react"
import type { ProductCategory } from "@/types/woocommerce"

interface ShopFiltersProps {
  categories: ProductCategory[]
  currentCategory?: string
  currentMinPrice?: string
  currentMaxPrice?: string
  currentSort?: string
}

export function ShopFilters({
  categories,
  currentCategory,
  currentMinPrice,
  currentMaxPrice,
  currentSort,
}: ShopFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(true)
  const [priceOpen, setPriceOpen] = useState(true)

  const filterContent = (
    <>
      {/* Category Filter */}
      <div className="border-b border-border pb-4">
        <button
          onClick={() => setCatOpen(!catOpen)}
          className="flex w-full items-center justify-between py-2 text-sm font-bold uppercase tracking-wider"
        >
          Kategori
          <ChevronDown className={`h-4 w-4 transition-transform ${catOpen ? "rotate-180" : ""}`} />
        </button>
        {catOpen && (
          <ul className="mt-2 space-y-1.5">
            <li>
              <a
                href="/shop"
                className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                  !currentCategory
                    ? "bg-brand-green/10 font-semibold text-brand-green"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Semua Produk
              </a>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <a
                  href={`/shop?category=${cat.slug}`}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors ${
                    currentCategory === cat.slug
                      ? "bg-brand-green/10 font-semibold text-brand-green"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {cat.name}
                  <span className="text-xs text-muted-foreground">({cat.count})</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Price Filter */}
      <div className="border-b border-border pb-4">
        <button
          onClick={() => setPriceOpen(!priceOpen)}
          className="flex w-full items-center justify-between py-2 text-sm font-bold uppercase tracking-wider"
        >
          Harga
          <ChevronDown className={`h-4 w-4 transition-transform ${priceOpen ? "rotate-180" : ""}`} />
        </button>
        {priceOpen && (
          <form method="GET" action="/shop" className="mt-2 space-y-3">
            {/* Preserve existing params */}
            {currentCategory && <input type="hidden" name="category" value={currentCategory} />}
            {currentSort && <input type="hidden" name="sort" value={currentSort} />}
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="min_price"
                placeholder="Min"
                defaultValue={currentMinPrice || ""}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand-green"
              />
              <span className="text-muted-foreground">—</span>
              <input
                type="number"
                name="max_price"
                placeholder="Max"
                defaultValue={currentMaxPrice || ""}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-green/90"
            >
              Terapkan
            </button>
          </form>
        )}
      </div>

      {/* Sort (for mobile) */}
      <div className="md:hidden pb-4">
        <label className="block py-2 text-sm font-bold uppercase tracking-wider">
          Urutkan
        </label>
        <form method="GET" action="/shop">
          {currentCategory && <input type="hidden" name="category" value={currentCategory} />}
          {currentMinPrice && <input type="hidden" name="min_price" value={currentMinPrice} />}
          {currentMaxPrice && <input type="hidden" name="max_price" value={currentMaxPrice} />}
          <select
            name="sort"
            defaultValue={currentSort || "date"}
            onChange={(e) => (e.target.form as HTMLFormElement).submit()}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value="date">Paling Baru</option>
            <option value="price-asc">Harga: Rendah ke Tinggi</option>
            <option value="price-desc">Harga: Tinggi ke Rendah</option>
            <option value="popularity">Paling Populer</option>
            <option value="rating">Rating Terbaik</option>
          </select>
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile: Filter trigger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filter
      </button>

      {/* Mobile: Drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-background p-6 shadow-xl animate-in slide-in-from-bottom">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Filter Produk</h3>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterContent}
          </div>
        </div>
      )}

      {/* Desktop: Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 space-y-4">
        <h3 className="text-lg font-bold">Filter</h3>
        {filterContent}
      </aside>
    </>
  )
}
