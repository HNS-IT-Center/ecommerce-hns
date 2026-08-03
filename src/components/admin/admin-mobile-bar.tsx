"use client"

import Link from "next/link"
import { Menu, StoreIcon } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { useAdminSwipeGesture } from "@/components/admin/use-admin-swipe-gesture"

export function AdminMobileBar() {
  const { setOpenMobile } = useSidebar()

  // Register swipe gesture globally for mobile
  useAdminSwipeGesture()

  return (
    <header className="flex md:hidden items-center justify-between px-4 h-14 bg-[#2166de] text-white shadow-lg shrink-0 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/admin" className="flex items-center gap-2.5 font-bold text-white">
        <div className="bg-white text-[#2166de] p-1 rounded-md shadow-sm shrink-0">
          <StoreIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-xs font-bold">HNS IT Center</span>
          <span className="text-[9px] font-normal text-blue-200">Administrator</span>
        </div>
      </Link>

      {/* Hamburger button */}
      <button
        onClick={() => setOpenMobile(true)}
        className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 transition-colors active:scale-95 cursor-pointer"
        aria-label="Buka menu"
      >
        <Menu className="h-5 w-5 text-white" />
      </button>
    </header>
  )
}
