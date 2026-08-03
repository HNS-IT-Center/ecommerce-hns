"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Cpu,
  Store,
  StoreIcon,
  ChevronLeft,
  ClipboardList,
  Megaphone,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { UserNav } from "@/components/admin/user-nav"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const adminNavItems = [
  { title: "Overview",     url: "/admin",          icon: LayoutDashboard },
  { title: "Produk",       url: "/admin/produk",   icon: Package },
  { title: "Kategori",     url: "/admin/kategori", icon: FolderTree },
  { title: "PC Builder",   url: "/admin/pc-builder", icon: Cpu },
  { title: "Banner Promo", url: "/admin/banner",   icon: Megaphone },
  { title: "Toko & Lokasi", url: "/admin/toko",    icon: Store },
  { title: "Logs",         url: "/admin/logs",     icon: ClipboardList },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, toggleSidebar } = useSidebar()

  return (
    <TooltipProvider delay={0}>
      <Sidebar
        collapsible="icon"
        style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
        className="admin-sidebar border-r border-white/10 text-white shadow-xl"
      >
        {/* Header */}
        <SidebarHeader
          className="h-[64px] flex flex-row items-center border-b border-white/20 px-4 relative shrink-0 bg-[#1a54c0]"
        >
          {open ? (
            <Link
              href="/admin"
              className="flex items-center gap-3 font-bold text-white hover:opacity-90 transition-opacity w-full"
            >
              <div className="bg-white rounded-lg p-1.5 shrink-0 shadow-sm">
                <StoreIcon className="h-5 w-5 text-[#2166de]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold leading-tight truncate">HNS IT Center</span>
                <span className="text-[10px] font-normal text-blue-200">Administrator</span>
              </div>
            </Link>
          ) : (
            <div className="w-full flex justify-center">
              <div className="bg-white rounded-lg p-1.5 shrink-0 shadow-sm">
                <StoreIcon className="h-5 w-5 text-[#2166de]" />
              </div>
            </div>
          )}

        </SidebarHeader>

        {/* Toggle button — edge of sidebar vertically centered */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-6 top-1/2 -translate-y-1/2 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 border-4 border-background shadow-lg hover:bg-slate-700 cursor-pointer transition-colors"
          title={open ? "Tutup sidebar" : "Buka sidebar"}
        >
          <ChevronLeft
            className="h-7 w-7 text-white transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
          />
        </button>

        {/* Navigation */}
        <SidebarContent className="py-4 px-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {adminNavItems.map((item) => {
                  const isActive =
                    item.url === "/admin"
                      ? pathname === "/admin"
                      : pathname === item.url || pathname.startsWith(item.url + "/")

                  const linkEl = (
                    <Link
                      href={item.url}
                      className={`flex items-center gap-3 rounded-xl w-full transition-colors duration-150 ${
                        open ? "px-3 py-2.5" : "justify-center py-2.5"
                      } ${
                        isActive
                          ? "bg-white/20 text-white font-semibold"
                          : "text-blue-100 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {open && (
                        <span className="font-medium text-sm">{item.title}</span>
                      )}
                    </Link>
                  )

                  return (
                    <SidebarMenuItem key={item.title}>
                      {!open ? (
                        <Tooltip>
                          <TooltipTrigger render={linkEl} />
                          <TooltipContent side="right" className="font-medium">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        linkEl
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Storefront Link (Bottom Nav Item) */}
        <div className="px-2 mt-auto mb-2">
          <Link
            href="/"
            target="_blank"
            className={`flex items-center gap-3 rounded-xl w-full transition-colors duration-150 text-blue-100 hover:text-white hover:bg-white/10 ${
              open ? "px-3 py-2.5" : "justify-center py-2.5"
            }`}
            title="Ke Toko"
          >
            <Store className="h-5 w-5 shrink-0" />
            {open && <span className="font-medium text-sm">Lihat Toko</span>}
          </Link>
        </div>

        {/* Footer */}
        <SidebarFooter className="p-4 border-t border-blue-600/40">
          <div className={`flex items-center ${open ? "gap-3" : "justify-center"}`}>
            <UserNav />
            {open && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">Admin</span>
                <span className="text-xs text-blue-200 truncate">admin@hnsitcenter.id</span>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  )
}
