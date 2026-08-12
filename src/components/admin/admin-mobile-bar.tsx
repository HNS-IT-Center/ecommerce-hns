"use client"

import Link from "next/link"
import Image from "next/image"
import { Menu } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { useAdminSwipeGesture } from "@/components/admin/use-admin-swipe-gesture"

export function AdminMobileBar() {
  const { setOpenMobile } = useSidebar()

  // Register swipe gesture globally for mobile
  useAdminSwipeGesture()

  return (
    // `admin-topbar` membawa gradasi yang sama persis dengan sidebar (lihat
    // `globals.css`) supaya bilah atas dan panel yang keluar dari bawahnya
    // terbaca sebagai satu permukaan, bukan dua biru yang berbeda.
    <header className="admin-topbar flex md:hidden items-center justify-between px-4 h-14 text-white shadow-md shrink-0 sticky top-0 z-40 border-b border-white/10">
      {/* Logo — memakai berkas yang sama dengan header sidebar; ikon toko
          sebelumnya hanyalah penampung sementara dan tidak mewakili merek. */}
      <Link href="/admin" className="flex items-center gap-2.5 font-bold text-white min-w-0">
        <div className="bg-white rounded-lg p-1 shadow-sm shrink-0 flex items-center justify-center h-8 w-8">
          <Image
            src="/images/hns-logo.png"
            alt="HNS IT Center Logo"
            width={24}
            height={24}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-xs font-bold truncate">HNS IT Center</span>
          <span className="text-[9px] font-normal text-blue-200">Administrator</span>
        </div>
      </Link>

      {/* Hamburger button */}
      <button
        onClick={() => setOpenMobile(true)}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 transition-colors active:scale-95 cursor-pointer"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5 text-white" />
      </button>
    </header>
  )
}
