"use client"

import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { useEffect, useState } from "react"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { cn } from "@/lib/utils"
import { CartSheet } from "./cart-sheet"

export function CartBadge() {
  const mounted = useIsHydrated()
  const totalItems = useCartStore((state) => state.getTotalItems())
  const [prevTotalItems, setPrevTotalItems] = useState(totalItems)
  const [isBumping, setIsBumping] = useState(false)

  // Adjust state during render (bukan di useEffect) saat totalItems berubah —
  // pola resmi React untuk "derive state from a prop/state change" tanpa
  // menambah instance baru dari bug setState-in-effect yang sudah ada di file lain.
  if (totalItems !== prevTotalItems) {
    setPrevTotalItems(totalItems)
    if (totalItems > prevTotalItems) {
      setIsBumping(true)
    }
  }

  useEffect(() => {
    if (!isBumping) return
    const timer = setTimeout(() => setIsBumping(false), 400)
    return () => clearTimeout(timer)
  }, [isBumping])

  // Server tidak tahu isi localStorage, jadi selalu render 0 barang saat SSR.
  // Pakai nilai yang sama sampai hydrated supaya aria-label tidak mismatch
  // (pola yang sama seperti badge angka di bawah).
  const displayedTotal = mounted ? totalItems : 0

  return (
    <CartSheet>
      <div
        aria-label={`Keranjang belanja, ${displayedTotal} barang`}
        className="cart-target-icon relative flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
      >
        <ShoppingCart className={cn("h-5 w-5 transition-transform", isBumping && "animate-bounce")} />
      {mounted && totalItems > 0 && (
        <span
          className={cn(
            "absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-sale-red text-[10px] font-bold text-white transition-transform duration-200",
            isBumping && "scale-125"
          )}
        >
          <span aria-hidden="true">{totalItems > 99 ? "99+" : totalItems}</span>
        </span>
      )}
      </div>
    </CartSheet>
  )
}
