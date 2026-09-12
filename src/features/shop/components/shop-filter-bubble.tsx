import { Filter } from "lucide-react"

import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { ShopSidebar } from "./shop-sidebar"
import type { ProductCategory } from "@/types/woocommerce"
import type { Brand } from "@/lib/api/woocommerce/brands"

interface ShopFilterBubbleProps {
  categories: ProductCategory[]
  brands: Brand[]
  maxPriceLimit: number
  /** Route tujuan saat filter berubah — `/shop` atau `/search`. */
  basePath?: string
  /** Nama query param kata kunci — `search` di `/shop`, `q` di `/search`. */
  searchParamName?: string
  /** Jumlah penyaring aktif; lihat `countActiveShopFilters`. */
  activeFilterCount: number
}

/**
 * Gelembung filter mobile — satu-satunya kontrol penyaringan yang tetap
 * terjangkau saat pembeli menggulung katalog, karena ia `fixed`.
 *
 * Dipisah jadi komponen sendiri karena `/shop` dan `/search` memakainya persis
 * sama. Sebelumnya markupnya disalin di kedua halaman, dan salinan itu sudah
 * mulai jadi beban: setiap perubahan harus dikerjakan dua kali dengan risiko
 * satunya tertinggal.
 *
 * Warnanya `bg-primary`, bukan hitam seperti dulu. Hitam membuatnya menyatu
 * dengan teks halaman dan terbaca seperti hiasan alih-alih tombol — padahal
 * sejak kata kunci ikut pindah ke dalam sheet-nya, inilah jalan masuk utama
 * penyaringan di mobile. Token, bukan hex: Theme Editor mendefinisikan ulang
 * `--primary` per tema, jadi gelembungnya ikut berganti warna tanpa disentuh.
 */
export function ShopFilterBubble({
  categories,
  brands,
  maxPriceLimit,
  basePath,
  searchParamName,
  activeFilterCount,
}: ShopFilterBubbleProps) {
  return (
    <div className="md:hidden fixed bottom-[160px] right-4 z-40">
      <Sheet>
        <SheetTrigger
          aria-label={
            activeFilterCount > 0
              ? `Filter & urutkan — ${activeFilterCount} filter aktif`
              : "Filter & urutkan"
          }
          className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:bg-primary/90 transition-transform active:scale-95"
        >
          <Filter className="h-5 w-5" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-sale-red px-1 text-[10px] font-bold leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </SheetTrigger>
        <SheetContent side="left" className="w-[85vw] sm:w-[400px] overflow-y-auto px-6 py-6 custom-scrollbar">
          <VisuallyHidden>
            <SheetTitle>Filter & Urutkan</SheetTitle>
          </VisuallyHidden>
          <div className="flex flex-col gap-6 pt-4">
            <ShopSidebar
              categories={categories}
              brands={brands}
              maxPriceLimit={maxPriceLimit}
              basePath={basePath}
              searchParamName={searchParamName}
              isMobile
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
