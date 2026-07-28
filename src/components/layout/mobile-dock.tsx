"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Monitor, ShoppingBag, ShoppingCart, User } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { cn } from "@/lib/utils"

export function MobileDock() {
  const pathname = usePathname()
  const mounted = useIsHydrated()
  const totalItems = useCartStore((state) => state.getTotalItems())
  
  // Hide dock if on desktop
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  if (isDesktop) return null

  const items = [
    {
      label: "Home",
      icon: <Home className="h-6 w-6" />,
      href: "/",
      isActive: pathname === "/",
    },
    {
      label: "PC Build",
      icon: <Monitor className="h-6 w-6" />,
      href: "/pc-build",
      isActive: pathname.startsWith("/pc-build"),
    },
    {
      label: "Shop",
      icon: <ShoppingBag className="h-6 w-6" />,
      href: "/shop",
      isActive: pathname.startsWith("/shop") || pathname.startsWith("/product") || pathname.startsWith("/search"),
    },
    {
      label: "Cart",
      icon: (
        <div className="relative flex items-center justify-center">
          <ShoppingCart className="h-6 w-6" />
          {mounted && totalItems > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-sale-red text-[10px] font-bold text-white">
              {totalItems > 99 ? "99+" : totalItems}
            </span>
          )}
        </div>
      ),
      href: "/cart",
      isActive: pathname === "/cart",
    },
    {
      label: "Account",
      icon: <User className="h-6 w-6" />,
      href: "/account",
      isActive: pathname.startsWith("/account"),
    },
  ]

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex h-16 w-full items-center justify-around px-2">
        {items.map((item, i) => (
          <Link 
            key={i} 
            href={item.href}
            className="group relative flex flex-col items-center justify-center w-16 h-full"
          >
            {/* The Icon Box */}
            <div 
              className={cn(
                "absolute flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300",
                item.isActive 
                  ? "bg-primary text-primary-foreground -translate-y-6 shadow-lg" 
                  : "bg-muted/50 text-muted-foreground top-1 group-hover:bg-muted"
              )}
            >
              {item.icon}
            </div>
            
            {/* The Text Label */}
            <span 
              className={cn(
                "absolute bottom-1 text-[10px] font-medium transition-all duration-300",
                item.isActive ? "text-primary opacity-100" : "text-muted-foreground opacity-100"
              )}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
