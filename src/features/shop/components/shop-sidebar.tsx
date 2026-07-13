"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProductCategory } from "@/types/woocommerce"
import { ChevronDown, ChevronUp } from "lucide-react"

interface ShopSidebarProps {
  categories: ProductCategory[]
}

export function ShopSidebar({ categories }: ShopSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentCategory = searchParams.get("category")
  const isOnSale = searchParams.get("onSale") === "true"

  // Track expanded categories
  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({})

  const handleCategoryChange = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) {
      params.set("category", slug)
    } else {
      params.delete("category")
    }
    params.delete("page")
    router.push(`/shop?${params.toString()}`)
  }

  const handleOnSaleChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    if (checked) {
      params.set("onSale", "true")
    } else {
      params.delete("onSale")
    }
    params.delete("page")
    router.push(`/shop?${params.toString()}`)
  }

  // Auto-expand the parent of the currently selected child category.
  // Derived during render, so no effect (and no setState-in-effect) is needed.
  const activeParentId = currentCategory
    ? categories.find((c) => c.slug === currentCategory && c.parent !== 0)?.parent
    : undefined

  // A category is expanded when the user has toggled it; otherwise it falls back
  // to the auto-expand rule above.
  const isCategoryExpanded = (catId: number) =>
    expandedCats[catId] ?? activeParentId === catId

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedCats((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? activeParentId === id),
    }))
  }

  // Build category hierarchy
  const rootCategories = categories.filter((c) => c.parent === 0)
  const getChildren = (parentId: number) => categories.filter((c) => c.parent === parentId)

  return (
    <div className="space-y-8">
      {/* Kategori Filter */}
      <div>
        <div className="mb-4 flex items-center gap-4">
          <h3 className="text-sm font-bold tracking-wider text-muted-foreground uppercase whitespace-nowrap">
            Filter Product
          </h3>
          <div className="h-px w-full bg-border" />
        </div>
        
        <ul className="flex flex-col">
          <li className="border-b border-muted/50 py-3">
            <button
              onClick={() => handleCategoryChange(null)}
              className={`text-sm text-left w-full uppercase transition-colors hover:text-brand-green ${
                !currentCategory ? "font-bold text-brand-green" : "font-medium text-foreground/80"
              }`}
            >
              SEMUA KATEGORI
            </button>
          </li>
          
          {rootCategories.map((cat) => {
            const children = getChildren(cat.id)
            const hasChildren = children.length > 0
            const isExpanded = isCategoryExpanded(cat.id)
            const isActive = currentCategory === cat.slug || children.some(c => c.slug === currentCategory)

            return (
              <li key={cat.id} className="border-b border-muted/50 flex flex-col">
                <div 
                  className={`flex items-center justify-between py-3 cursor-pointer group transition-colors ${
                    isActive ? "text-brand-green" : "text-foreground/80 hover:text-brand-green"
                  }`}
                  onClick={() => handleCategoryChange(cat.slug)}
                >
                  <span className={`text-sm uppercase ${isActive ? 'font-bold' : 'font-medium'}`}>
                    {cat.name}
                  </span>
                  
                  {hasChildren && (
                    <button 
                      onClick={(e) => toggleExpand(cat.id, e)}
                      className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-all"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                
                {/* Render children if expanded */}
                {hasChildren && isExpanded && (
                  <ul className="pb-3 flex flex-col space-y-2">
                    {children.map((child) => {
                      const isChildActive = currentCategory === child.slug
                      return (
                        <li key={child.id}>
                          <button
                            onClick={() => handleCategoryChange(child.slug)}
                            className={`w-full text-left px-4 text-xs uppercase transition-colors ${
                              isChildActive 
                                ? "font-bold text-brand-green" 
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {child.name}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* Promo Filter */}
      <div>
        <div className="mb-4 flex items-center gap-4">
          <h3 className="text-sm font-bold tracking-wider text-muted-foreground uppercase whitespace-nowrap">
            Promo Spesial
          </h3>
          <div className="h-px w-full bg-border" />
        </div>
        <label className="flex items-center gap-3 cursor-pointer group p-3 border rounded-lg hover:border-brand-green transition-colors">
          <input
            type="checkbox"
            checked={isOnSale}
            onChange={(e) => handleOnSaleChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
          />
          <span className="text-sm font-bold text-sale-red group-hover:text-red-600">Hanya Tampilkan Promo</span>
        </label>
      </div>
    </div>
  )
}
