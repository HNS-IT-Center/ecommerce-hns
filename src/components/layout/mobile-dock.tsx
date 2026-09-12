"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Monitor, PcCase, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { ChristmasDockDecor } from "@/components/theme/christmas-decor"

/**
 * `isChristmas` dioper sebagai prop dari root layout, bukan dibaca sendiri —
 * komponen ini berjalan di klien dan tidak bisa menyentuh database.
 *
 * Komponen ini sengaja TIDAK lagi membaca status login sama sekali. Dulu ia
 * memanggil `useCustomer()` hanya untuk memilih tujuan tombol "Akun", padahal
 * `/profile` sudah mengurus pengunjung tanpa sesi lewat redirect di server. Satu
 * fetch `/api/auth/me` per pemuatan halaman mobile hilang, dan dengan begitu
 * hilang pula jendela di mana dock menebak status login secara keliru.
 */
export function MobileDock({ isChristmas = false }: { isChristmas?: boolean }) {
  const pathname = usePathname()

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
      /**
       * Menggantikan tombol Keranjang yang dulu di slot ini.
       *
       * Keranjang tidak kehilangan tempat: `CartBadge` di header `fixed`
       * membawanya di pojok kanan atas pada tiap halaman, lengkap dengan
       * penghitung isinya — jadi slot ini rangkap, sementara PC Prebuild sama
       * sekali tidak punya pintu di mobile meski ada di menu header desktop.
       *
       * Badge jumlah item tidak dibawa ke sini: satu-satunya yang perlu
       * menampilkannya adalah keranjang, dan ia sudah punya badge sendiri di
       * header. Dengan begitu dock tidak lagi berlangganan `useCartStore`, dan
       * ia tidak perlu menunggu hydration hanya untuk memutuskan menampilkan
       * angka.
       */
      label: "PC Prebuild",
      icon: <PcCase className="h-6 w-6" />,
      href: "/pc-prebuild",
      isActive: pathname.startsWith("/pc-prebuild"),
    },
    {
      label: "Profil",
      icon: <User className="h-6 w-6" />,
      /**
       * Selalu `/profile`, tidak pernah bercabang di klien.
       *
       * Sebelumnya `customer ? "/profile" : "/login"`, dan karena status login
       * baru tiba setelah fetch `/api/auth/me` selesai, tap di detik-detik
       * pertama membawa pelanggan yang sudah login ke halaman login.
       *
       * Percabangannya tidak perlu diperbaiki, cukup dihapus: `/profile/page.tsx`
       * sudah memanggil `redirect("/login")` untuk pengunjung tanpa sesi. Itu
       * keputusan server yang membaca cookie sungguhan — lebih benar daripada
       * tebakan klien, dan tetap benar sebelum hydration selesai. Guest tetap
       * mendarat di /login, hanya lewat satu lompatan.
       */
      href: "/profile",
      isActive: pathname.startsWith("/profile") || pathname === "/login",
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
