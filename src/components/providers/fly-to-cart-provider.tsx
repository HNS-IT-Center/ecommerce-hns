"use client"

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, X } from "lucide-react"

type FlyItem = {
  id: string
  startX: number
  startY: number
  image?: string // Optional product image
}

type FlyToCartContextType = {
  flyToCart: (x: number, y: number, image?: string) => void
  showCartToast: () => void
}

const FlyToCartContext = createContext<FlyToCartContextType | null>(null)

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FlyItem[]>([])

  const flyToCart = useCallback((startX: number, startY: number, image?: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setItems((prev) => [...prev, { id, startX, startY, image }])
    
    // Hapus elemen setelah animasi selesai (800ms)
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }, 800)
  }, [])

  const [toastVisible, setToastVisible] = useState(false)
  const [toastCount, setToastCount] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const showCartToast = useCallback(() => {
    setToastVisible(true)
    setToastCount((prev) => prev + 1)
    
    if (timerRef.current) clearTimeout(timerRef.current)
    
    timerRef.current = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setToastCount(0), 500)
    }, 3000)
  }, [])

  return (
    <FlyToCartContext.Provider value={{ flyToCart, showCartToast }}>
      {children}
      <AnimatePresence>
        {items.map((item) => (
          <FlyElement key={item.id} item={item} />
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed top-20 md:top-24 right-4 z-[9999] flex items-center gap-3 rounded-lg bg-card p-4 shadow-xl border border-border"
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-foreground">
              Successfully add to cart {toastCount > 1 ? `(${toastCount})` : ""}
            </span>
            <button
              onClick={() => {
                setToastVisible(false)
                if (timerRef.current) clearTimeout(timerRef.current)
                setTimeout(() => setToastCount(0), 500)
              }}
              className="ml-2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </FlyToCartContext.Provider>
  )
}

export function useFlyToCart() {
  const context = useContext(FlyToCartContext)
  if (!context) {
    throw new Error("useFlyToCart must be used within a FlyToCartProvider")
  }
  return context
}

function FlyElement({ item }: { item: FlyItem }) {
  const [target, setTarget] = useState({ x: item.startX, y: item.startY })

  useEffect(() => {
    const cartEls = document.querySelectorAll(".cart-target-icon")
    
    // Cari elemen yang tidak ter-hide oleh CSS (width > 0)
    const visibleCart = Array.from(cartEls).find(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
    
    if (visibleCart) {
      const rect = visibleCart.getBoundingClientRect()
      // Pusatkan bola di ikon target
      setTarget({
        x: rect.left + rect.width / 2 - 12, // 12 adalah setengah dari ukuran bola (24px)
        y: rect.top + rect.height / 2 - 12,
      })
    } else {
      // Fallback koordinat jika ikon tidak ditemukan (pojok kanan atas)
      setTarget({
        x: window.innerWidth - 40,
        y: 20,
      })
    }
  }, [item])

  return (
    <motion.div
      initial={{ 
        x: item.startX - 12, 
        y: item.startY - 12, 
        scale: 0.5, 
        opacity: 0,
        rotate: 0
      }}
      animate={{ 
        x: target.x, 
        y: target.y, 
        scale: [0.5, 1.2, 0.2], 
        opacity: [0, 1, 0.8, 0],
        rotate: 360
      }}
      transition={{ 
        duration: 0.8, 
        ease: "easeInOut",
        times: [0, 0.2, 0.8, 1] 
      }}
      className="fixed z-[9999] pointer-events-none flex h-6 w-6 items-center justify-center rounded-full bg-brand-green shadow-xl border-2 border-white overflow-hidden"
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-2 w-2 rounded-full bg-white" />
      )}
    </motion.div>
  )
}
