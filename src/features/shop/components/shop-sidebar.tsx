"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ProductCategory } from "@/types/woocommerce"
import { ChevronDown, ChevronRight, Search } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { Brand } from "@/lib/api/woocommerce/brands"

interface ShopSidebarProps {
  categories: ProductCategory[]
  brands?: Brand[]
  maxPriceLimit?: number
  isMobile?: boolean
  /**
   * Route tujuan saat filter berubah. Default `/shop`.
   *
   * Sidebar ini dipakai di dua route (`/shop` dan `/search`) yang keduanya
   * memakai set filter yang sama. Tanpa prop ini setiap centang filter di
   * `/search` akan melempar pembeli ke `/shop` dan keyword-nya hilang.
   */
  basePath?: string
  /**
   * Nama query param kata kunci pencarian yang harus DIPERTAHANKAN saat
   * "Hapus Filter" ditekan — `search` di `/shop`, `q` di `/search`.
   * Menghapus filter berarti membuang kategori/merek/harga, bukan membatalkan
   * pencarian yang sedang dilihat pembeli.
   */
  searchParamName?: string
}

export function ShopSidebar({
  categories,
  brands = [],
  maxPriceLimit = 100000000,
  isMobile,
  basePath = "/shop",
  searchParamName = "search",
}: ShopSidebarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentCategories = searchParams.getAll("category")
  const currentBrands = searchParams.getAll("brand")
  const isOnSale = searchParams.get("onSale") === "true"

  const [categorySearch, setCategorySearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  
  const initialMin = Number(searchParams.get("minPrice")) || 0
  const initialMax = Number(searchParams.get("maxPrice")) || maxPriceLimit
  const [localPriceRange, setLocalPriceRange] = useState([initialMin, initialMax])

  const [expandedCats, setExpandedCats] = useState<Record<number, boolean>>({})

  // Independent custom accordion states (all true by default)
  const [openSections, setOpenSections] = useState({
    category: true,
    brand: true,
    price: true,
    other: true
  })

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  // Auto-expand the parent of the currently selected child categories.
  const currentCategoriesStr = currentCategories.join(",")
  useEffect(() => {
    const parentIdsToExpand: Record<number, boolean> = {}
    currentCategories.forEach(slug => {
      const cat = categories.find(c => c.slug === slug)
      if (cat && cat.parent !== 0) {
        parentIdsToExpand[cat.parent] = true
      }
    })
    setExpandedCats(prev => {
      let hasChanges = false
      const next = { ...prev }
      for (const id in parentIdsToExpand) {
        if (!next[id]) {
          next[id] = true
          hasChanges = true
        }
      }
      return hasChanges ? next : prev
    })
  }, [categories, currentCategoriesStr])

  const handleCategoryChange = (slug: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (checked) {
      if (!currentCategories.includes(slug)) params.append("category", slug)
    } else {
      params.delete("category")
      currentCategories.forEach(c => {
        if (c !== slug) params.append("category", c)
      })
    }
    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  const handleBrandChange = (slug: string, checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (checked) {
      if (!currentBrands.includes(slug)) params.append("brand", slug)
    } else {
      params.delete("brand")
      currentBrands.forEach(b => {
        if (b !== slug) params.append("brand", b)
      })
    }
    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  const handleOnSaleChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (checked) params.set("onSale", "true")
    else params.delete("onSale")
    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  const handlePriceCommit = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (localPriceRange[0] > 0) params.set("minPrice", localPriceRange[0].toString())
    else params.delete("minPrice")
    
    if (localPriceRange[1] < maxPriceLimit) params.set("maxPrice", localPriceRange[1].toString())
    else params.delete("maxPrice")

    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  // Reset local state if external URL changes
  useEffect(() => {
    const currentMin = Number(searchParams.get("minPrice")) || 0
    const currentMax = Number(searchParams.get("maxPrice")) || maxPriceLimit
    if (currentMin !== localPriceRange[0] || currentMax !== localPriceRange[1]) {
      setLocalPriceRange([currentMin, currentMax])
    }
  }, [searchParams, maxPriceLimit])

  const clearFilters = () => {
    // Kata kunci pencarian bukan filter — ia konteks halaman yang sedang
    // dilihat pembeli. Membuangnya di sini akan mengosongkan hasil `/search`.
    const keyword = searchParams.get(searchParamName)
    const params = new URLSearchParams()
    if (keyword) params.set(searchParamName, keyword)
    const queryString = params.toString()
    router.push(queryString ? `${basePath}?${queryString}` : basePath, { scroll: false })
  }

  const toggleExpand = (id: number) => {
    setExpandedCats(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
  
  const rootCategories = categories.filter(c => c.parent === 0)
  const getChildren = (parentId: number) => categories.filter(c => c.parent === parentId)

  const isCatVisible = (cat: ProductCategory) => {
    if (!categorySearch) return true
    const searchLow = categorySearch.toLowerCase()
    if (cat.name.toLowerCase().includes(searchLow)) return true
    const children = getChildren(cat.id)
    return children.some(child => child.name.toLowerCase().includes(searchLow))
  }

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID').format(val)
  }
  
  const parseIDR = (val: string) => {
    const numbers = val.replace(/[^0-9]/g, "")
    return numbers ? parseInt(numbers, 10) : 0
  }

  return (
    <div className="flex flex-col pb-10">
      <div className="flex items-center justify-between mb-4 border-b border-border pb-4">
        {isMobile && <h2 className="text-xl font-bold">Filters</h2>}
        <button 
          onClick={clearFilters}
          className={`text-sm font-semibold text-sale-red hover:underline transition-all ${!isMobile ? 'ml-auto' : ''}`}
        >
          Hapus Filter
        </button>
      </div>

      <div className="flex flex-col w-full">
        {/* Kategori Filter */}
        <div className="border-b border-border pb-6 mb-6">
          <button 
            onClick={() => toggleSection("category")}
            className="flex w-full items-center justify-between group py-1 mb-2"
          >
            <h3 className="text-base font-bold text-foreground group-hover:text-brand-green transition-colors">Kategori</h3>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.category ? 'rotate-180' : ''}`} />
          </button>
          
          {openSections.category && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Cari kategori..." 
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  className="pl-9 h-9" 
                />
              </div>

              <div className="flex flex-col max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {rootCategories.filter(isCatVisible).map(cat => {
                  const children = getChildren(cat.id)
                  const hasChildren = children.length > 0
                  const forceExpand = categorySearch && children.some(child => child.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  const isExpanded = expandedCats[cat.id] || forceExpand

                  return (
                    <div key={cat.id} className="flex flex-col mb-1 pb-1">
                      <div className="flex items-center justify-between py-1.5 group">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id={`cat-${cat.id}`} 
                            checked={currentCategories.includes(cat.slug)}
                            onCheckedChange={(checked) => handleCategoryChange(cat.slug, !!checked)}
                          />
                          <label 
                            htmlFor={`cat-${cat.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-foreground/90 hover:text-brand-green transition-colors"
                          >
                            {cat.name}
                          </label>
                        </div>
                        
                        {hasChildren && (
                          <button 
                            onClick={() => toggleExpand(cat.id)}
                            className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-all"
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                      
                      {hasChildren && isExpanded && (
                        <div className="ml-6 flex flex-col space-y-2 mt-1 mb-2">
                          {children.filter(child => !categorySearch || child.name.toLowerCase().includes(categorySearch.toLowerCase())).map(child => (
                            <div key={child.id} className="flex items-center space-x-2 py-1">
                              <Checkbox 
                                id={`cat-${child.id}`} 
                                checked={currentCategories.includes(child.slug)}
                                onCheckedChange={(checked) => handleCategoryChange(child.slug, !!checked)}
                              />
                              <label 
                                htmlFor={`cat-${child.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-muted-foreground hover:text-brand-green transition-colors"
                              >
                                {child.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Brand Filter */}
        {brands.length > 0 && (
          <div className="border-b border-border pb-6 mb-6">
            <button 
              onClick={() => toggleSection("brand")}
              className="flex w-full items-center justify-between group py-1 mb-2"
            >
              <h3 className="text-base font-bold text-foreground group-hover:text-brand-green transition-colors">Merek</h3>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.brand ? 'rotate-180' : ''}`} />
            </button>
            
            {openSections.brand && (
              <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    placeholder="Cari merek..." 
                    value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    className="pl-9 h-9" 
                  />
                </div>

                <div className="flex flex-col max-h-[250px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {filteredBrands.map(brand => (
                    <div key={brand.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`brand-${brand.id}`} 
                        checked={currentBrands.includes(brand.slug)}
                        onCheckedChange={(checked) => handleBrandChange(brand.slug, !!checked)}
                      />
                      <label 
                        htmlFor={`brand-${brand.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-foreground/90 hover:text-brand-green transition-colors"
                      >
                        {brand.name}
                      </label>
                    </div>
                  ))}
                  {filteredBrands.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Merek tidak ditemukan.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Harga Filter */}
        <div className="border-b border-border pb-6 mb-6">
          <button 
            onClick={() => toggleSection("price")}
            className="flex w-full items-center justify-between group py-1 mb-2"
          >
            <h3 className="text-base font-bold text-foreground group-hover:text-brand-green transition-colors">Harga</h3>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.price ? 'rotate-180' : ''}`} />
          </button>
          
          {openSections.price && (
            <div className="pt-2 flex flex-col gap-3 animate-in fade-in slide-in-from-top-1">
              <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                  <Input 
                    className="pl-10 h-10 bg-background" 
                    value={localPriceRange[0] === 0 ? "" : formatIDR(localPriceRange[0])}
                    onBlur={handlePriceCommit}
                    onKeyDown={(e) => e.key === 'Enter' && handlePriceCommit()}
                    onChange={(e) => {
                      const val = parseIDR(e.target.value)
                      setLocalPriceRange([val, localPriceRange[1]])
                    }}
                    placeholder="Harga Minimum"
                  />
              </div>
              <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">Rp</span>
                  <Input 
                    className="pl-10 h-10 bg-background" 
                    value={localPriceRange[1] === maxPriceLimit ? "" : formatIDR(localPriceRange[1])}
                    onBlur={handlePriceCommit}
                    onKeyDown={(e) => e.key === 'Enter' && handlePriceCommit()}
                    onChange={(e) => {
                      const val = parseIDR(e.target.value)
                      setLocalPriceRange([localPriceRange[0], val])
                    }}
                    placeholder="Harga Maksimum"
                  />
              </div>
            </div>
          )}
        </div>

        {/* Promo Filter */}
        <div className="pb-6 mb-6">
          <button 
            onClick={() => toggleSection("other")}
            className="flex w-full items-center justify-between group py-1 mb-2"
          >
            <h3 className="text-base font-bold text-foreground group-hover:text-brand-green transition-colors">Lainnya</h3>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.other ? 'rotate-180' : ''}`} />
          </button>
          
          {openSections.other && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center space-x-2 group">
                <Checkbox 
                  id="onSale" 
                  checked={isOnSale}
                  onCheckedChange={(checked) => handleOnSaleChange(!!checked)}
                />
                <label 
                  htmlFor="onSale"
                  className="text-sm font-bold text-sale-red group-hover:text-red-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Hanya Tampilkan Promo
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {isMobile && (
        <div className="mt-2">
            <button 
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))}
              className="w-full bg-brand-green text-white font-bold py-3 rounded-lg hover:bg-brand-green/90 transition-colors shadow-md"
            >
              Terapkan Filter
            </button>
        </div>
      )}
    </div>
  )
}
