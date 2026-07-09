"use client"

import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function CartBadge() {
  const [mounted, setMounted] = useState(false)
  const totalItems = useCartStore((state) => state.getTotalItems())
  const [prevTotalItems, setPrevTotalItems] = useState(totalItems)
  const [isBumping, setIsBumping] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  return (
    <Link href="/cart" className="relative flex items-center p-2 text-muted-foreground hover:text-foreground transition-colors">
      <ShoppingCart className={cn("h-5 w-5 transition-transform", isBumping && "animate-bounce")} />
      {mounted && totalItems > 0 && (
        <span
          className={cn(
            "absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-sale-red text-[10px] font-bold text-white transition-transform duration-200",
            isBumping && "scale-125"
          )}
        >
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </Link>
  )
}
