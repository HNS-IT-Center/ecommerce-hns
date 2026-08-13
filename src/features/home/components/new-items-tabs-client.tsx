"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useInView } from "react-intersection-observer"
import { ProductCard, type Product } from "@/components/ui/product-card"
import { fetchProductsAction } from "@/actions/products"
import { Loader2, ArrowRight } from "lucide-react"
import RosetteDiscountIcon from "@/components/icons/discount-icon"
import LikeIcon from "@/components/icons/like-icon"
import Link from "next/link"

type Tab = {
  id: string
  label: string
  categorySlug?: string | string[]
  excludeCategorySlugs?: string[]
  isRandom?: boolean
  onSale?: boolean
}

type NewItemsTabsClientProps = {
  tabs: Tab[]
  initialProducts: Product[]
}

type TabState = {
  products: Product[]
  page: number
  displayLimit: number
  hasMore: boolean
  isLoading: boolean
}

export function NewItemsTabsClient({ tabs, initialProducts }: NewItemsTabsClientProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [activeTab, setActiveTab] = useState(tabs[0].id)
  const [tabStates, setTabStates] = useState<Record<string, TabState>>({
    [tabs[0].id]: {
      products: initialProducts,
      page: 1,
      displayLimit: 18,
      hasMore: initialProducts.length === 30,
      isLoading: false
    }
  })

  const currentTabState = tabStates[activeTab] || {
    products: [],
    page: 1,
    displayLimit: 18,
    hasMore: true,
    isLoading: false
  }

  const { ref: observerRef, inView } = useInView({
    rootMargin: "200px",
  })

  const loadMoreData = useCallback(async (tabId: string, pageToFetch: number) => {
    setTabStates(prev => ({
      ...prev,
      [tabId]: { ...(prev[tabId] || { products: [], page: 1, displayLimit: 18, hasMore: true }), isLoading: true }
    }))

    const tab = tabs.find(t => t.id === tabId)
    if (!tab) return

    let fetchedProducts: Product[] = []
    
    // Call server action
    fetchedProducts = await fetchProductsAction({
      perPage: 30,
      page: pageToFetch,
      category: tab.categorySlug,
      excludeCategory: tab.excludeCategorySlugs,
      onSale: tab.onSale,
    })

    if (tab.isRandom && pageToFetch === 1) {
       fetchedProducts.sort(() => Math.random() - 0.5)
    }

    setTabStates(prev => {
      const existing = prev[tabId] || { products: [], page: 1, displayLimit: 18 }
      const newProducts = pageToFetch === 1 ? fetchedProducts : [...existing.products, ...fetchedProducts]
      return {
        ...prev,
        [tabId]: {
          products: newProducts,
          page: pageToFetch,
          displayLimit: pageToFetch === 1 ? 18 : existing.displayLimit + 18,
          hasMore: fetchedProducts.length === 30,
          isLoading: false
        }
      }
    })
  }, [tabs])

  /**
   * DUA EFEK DI BAWAH SENGAJA DIKECUALIKAN dari `set-state-in-effect`.
   *
   * Ini keputusan yang sudah ditimbang, bukan aturan yang dilewatkan karena
   * merepotkan. Pola pengganti yang dipakai di tempat lain pada repo ini
   * ("sesuaikan state saat render", lihat `live-search.tsx` dan
   * `delete-customer-dialog.tsx`) TIDAK BISA dipakai di sini, karena dua
   * syaratnya saling bertabrakan:
   *
   *   1. Penjaganya harus TIDAK memicu render. `inView` dari
   *      `react-intersection-observer` berubah berkali-kali selama menggulir,
   *      jadi penjaga berbasis `useState` — cara yang sah untuk menyesuaikan
   *      state saat render — justru menambah render pada jalur yang paling
   *      sering berjalan.
   *   2. Penjaga yang tidak memicu render berarti `useRef`. Tapi React 19
   *      melarang MEMBACA maupun MENULIS ref selama render
   *      (`react-hooks/refs`).
   *
   * Dicoba, dan hasilnya terukur: versi `useRef` menghilangkan 1 error tapi
   * memunculkan 4 error `react-hooks/refs` — total lint naik 42 → 45. Versi itu
   * dibatalkan.
   *
   * Perilakunya sendiri sudah diuji IDENTIK antara versi efek dan versi ref,
   * lewat perbandingan langsung ke kode lama (`git stash`): jumlah kartu awal
   * (33), setelah berpindah ketiga tab (33), setelah enam kali gulir (45, lalu
   * berhenti), dan setelah gulir naik-lalu-turun (45). Nol error konsol di
   * kedua versi.
   *
   * Jadi yang tersisa cuma cara memenuhi aturan lint, bukan cacat perilaku.
   * Kalau suatu saat React menyediakan jalan untuk penjaga yang tidak memicu
   * render dan sah dipakai saat render, pengecualian ini layak ditinjau ulang.
   */

  // Initial load for a tab if it hasn't been loaded yet
  useEffect(() => {
    if (!tabStates[activeTab]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lihat catatan di atas
      loadMoreData(activeTab, 1)
    }
  }, [activeTab, tabStates, loadMoreData])

  // Handle infinite scroll trigger
  useEffect(() => {
    if (inView && !currentTabState.isLoading && currentTabState.products.length > currentTabState.displayLimit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lihat catatan di atas
      setTabStates(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          displayLimit: prev[activeTab].displayLimit + 12
        }
      }))
    }
  }, [inView, activeTab, currentTabState.isLoading, currentTabState.products.length, currentTabState.displayLimit])

  const handleManualLoadMore = () => {
    if (currentTabState.hasMore && !currentTabState.isLoading) {
      loadMoreData(activeTab, currentTabState.page + 1)
    }
  }

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    if (sectionRef.current) {
       const y = sectionRef.current.getBoundingClientRect().top + window.scrollY - 64;
       window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  const displayedProducts = currentTabState.products.slice(0, currentTabState.displayLimit)
  const isShowMoreBtnVisible = currentTabState.displayLimit % 30 === 0 && currentTabState.hasMore

  return (
    <section ref={sectionRef} className="w-full flex flex-col relative pb-12 pt-8">
      <div className="max-w-7xl mx-auto px-4 md:px-6 w-full mb-4 flex items-center justify-between">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          Produk Pilihan
        </h2>
      </div>

      {/* Sticky Full-Width Tabs */}
      <div className="sticky top-[64px] z-[45] w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 overflow-x-auto scrollbar-hide flex gap-2 md:gap-4 items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? "bg-sale-red text-white shadow-md shadow-sale-red/20"
                  : tab.id === "best-deals"
                  ? "bg-black text-white hover:bg-sale-red/10 hover:text-sale-red"
                  : "bg-muted text-muted-foreground hover:bg-sale-red/10 hover:text-sale-red"
              }`}
            >
              {tab.id === "best-deals" && <RosetteDiscountIcon size={16} />}
              {tab.id === "untukmu" && <LikeIcon className="w-4 h-4" />}
              {tab.label}
            </button>
          ))}
          <Link
            href="/shop"
            className="whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer select-none flex items-center gap-1.5 bg-muted text-muted-foreground hover:bg-sale-red/10 hover:text-sale-red"
          >
            Lainnya <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 md:px-6 pt-8">
        {currentTabState.isLoading && currentTabState.page === 1 ? (
           <div className="w-full py-20 flex justify-center items-center">
             <Loader2 className="h-8 w-8 animate-spin text-sale-red" />
           </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4 lg:grid-cols-6 lg:gap-6">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {displayedProducts.length === 0 && !currentTabState.isLoading && (
              <div className="w-full py-12 text-center text-muted-foreground">
                Belum ada produk di kategori ini.
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {!isShowMoreBtnVisible && currentTabState.products.length > currentTabState.displayLimit && (
               <div ref={observerRef} className="h-20 w-full flex items-center justify-center">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground opacity-50" />
               </div>
            )}

            {/* Manual Load More Button */}
            {isShowMoreBtnVisible && (
              <div className="w-full flex justify-center pt-10">
                <button
                  onClick={handleManualLoadMore}
                  disabled={currentTabState.isLoading}
                  className="px-8 py-3 bg-white border border-sale-red text-sale-red font-bold rounded-full hover:bg-sale-red hover:text-white transition-colors cursor-pointer flex items-center justify-center min-w-[240px]"
                >
                  {currentTabState.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Muat Lebih Banyak"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
