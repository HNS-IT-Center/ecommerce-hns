"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Monitor, ShoppingBag, ShoppingCart, User } from "lucide-react"
import { useCartStore } from "@/store/cart"
import { useIsHydrated } from "@/hooks/use-is-hydrated"
import { useCustomer } from "@/hooks/use-customer"
import { cn } from "@/lib/utils"
import { ChristmasDockDecor } from "@/components/theme/christmas-decor"

/**
 * `isChristmas` dioper sebagai prop dari root layout, bukan dibaca sendiri —
 * komponen ini berjalan di klien dan tidak bisa menyentuh database. Status
 * login TIDAK dioper sebagai prop server (lihat hooks/use-customer.ts) —
 * membaca cookies() di RootLayout akan menandai seluruh storefront dynamic.
 */
export function MobileDock({ isChristmas = false }: { isChristmas?: boolean }) {
  const pathname = usePathname()
  const mounted = useIsHydrated()
  const { customer } = useCustomer()
  const totalItems = useCartStore((state) => state.getTotalItems())
  
  // Hide dock if on desktop or admin routes
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const isAdmin = pathname.startsWith('/admin')

  /**
   * Halaman produk punya bar aksinya sendiri (harga + keranjang + WhatsApp)
   * yang mengambang di dasar layar. Menumpuknya dengan dock membuat sepertiga
   * layar mobile habis untuk kontrol. Akses keranjang tidak hilang: header
   * `fixed` di atas tetap membawa CartBadge, dan tombol kembali di header
   * menggantikan peran navigasi dock di halaman ini.
   */
  const isProductPage = pathname.startsWith('/product/')

  if (isDesktop || isAdmin || isProductPage) return null

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
      href: "/build-pc",
      isActive: pathname.startsWith("/build-pc"),
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
        <div id="cart-icon-mobile" className="relative flex items-center justify-center">
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
      label: "Akun",
      icon: <User className="h-6 w-6" />,
      href: customer ? "/akun" : "/login",
      isActive: pathname.startsWith("/akun") || pathname === "/login",
    },
  ]

  return (
    <div className="theme-chrome no-print print:hidden md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.05)] pb-safe">
      {isChristmas && <ChristmasDockDecor />}
      <div className="flex h-[60px] w-full items-center justify-around px-2">
        {items.map((item, i) => (
          <Link 
            key={i} 
            href={item.href}
            className="group relative flex flex-col items-center justify-center h-full flex-1"
          >
            {/* The Icon Box */}
            <div 
              className={cn(
                "flex items-center justify-center mb-0.5 transition-all duration-300",
                item.isActive 
                  ? "text-brand-green" 
                  : "text-muted-foreground group-hover:text-foreground"
              )}
            >
              {item.icon}
            </div>
            
            {/* The Text Label */}
            <span 
              className={cn(
                "text-[10px] transition-all duration-300",
                item.isActive ? "text-brand-green font-bold" : "text-muted-foreground font-medium group-hover:text-foreground"
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
