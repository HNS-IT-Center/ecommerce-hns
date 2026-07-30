"use client"

import { useCartStore } from "@/store/cart"
import { formatRupiah } from "@/lib/utils"
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter
} from "@/components/ui/sheet"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

export function CartSheet({ children }: { children: React.ReactNode }) {
  const { items, removeItem, updateQuantity, toggleSelect, toggleSelectAll, getSelectedTotalPrice } = useCartStore()
  const mounted = useIsHydrated()
  const router = useRouter()
  
  const [isOpen, setIsOpen] = useState(false)

  if (!mounted) {
    return <div onClick={(e) => e.preventDefault()}>{children}</div>
  }

  const allSelected = items.length > 0 && items.every((i) => i.selected !== false)
  const selectedCount = items.filter((i) => i.selected !== false).length

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger className="appearance-none bg-transparent p-0 m-0 border-none inline-flex items-center justify-center">
        {children}
      </SheetTrigger>
      <SheetContent className="flex flex-col w-full sm:max-w-md p-0 border-none drop-shadow-2xl">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="text-xl font-bold flex items-center justify-between">
            <span>Keranjang Belanja</span>
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">
              {items.length} Item
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold">Keranjang Kosong</h3>
              <p className="text-sm text-muted-foreground">
                Belum ada produk di keranjang Anda.
              </p>
              <Button onClick={() => setIsOpen(false)} variant="default" className="mt-4">
                Mulai Belanja
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id="selectAll"
                  checked={allSelected}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="selectAll" className="text-sm font-medium cursor-pointer">
                  Pilih Semua
                </label>
              </div>

              <div className="space-y-4">
                {items.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => toggleSelect(item.id)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-card drop-shadow-md hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <input 
                      type="checkbox"
                      checked={item.selected !== false}
                      readOnly
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0 pointer-events-none"
                    />
                    
                    {/* Product Image */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <ShoppingBag className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex flex-1 flex-col justify-between self-stretch py-1">
                      <div>
                        <h4 className="font-semibold text-sm leading-tight line-clamp-2">
                          {item.name}
                        </h4>
                        {item.variationLabel && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.variationLabel}
                          </p>
                        )}
                        <div className="mt-1 font-bold text-foreground text-sm">
                          {formatRupiah(item.price)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center rounded-lg border bg-background h-8">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.quantity - 1) }}
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-l-lg cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="flex h-8 w-8 items-center justify-center text-xs font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, item.quantity + 1) }}
                            className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground rounded-r-lg cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        
                        <button
                          onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                          className="flex items-center justify-center text-muted-foreground hover:text-sale-red cursor-pointer p-1"
                          aria-label="Hapus item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-card mt-auto space-y-4 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.1)] z-10">
            <div className="flex justify-between items-end mb-4">
              <span className="text-sm text-muted-foreground">Total ({selectedCount} item)</span>
              <span className="text-xl font-extrabold text-sale-red">{formatRupiah(getSelectedTotalPrice())}</span>
            </div>
            
            <Button 
              className="w-full h-14 flex flex-col items-center justify-center"
              size="lg"
              disabled={selectedCount === 0}
              onClick={() => {
                setIsOpen(false)
                router.push('/checkout')
              }}
            >
              <span className="font-bold text-base">Checkout Now</span>
              <span className="text-xs opacity-90">{formatRupiah(getSelectedTotalPrice())}</span>
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full h-12"
              onClick={() => {
                setIsOpen(false)
                router.push('/cart')
              }}
            >
              View my cart
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
