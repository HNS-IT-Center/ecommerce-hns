"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Cpu,
  Store,
  ChevronLeft,
  ChevronDown,
  ClipboardList,
  Megaphone,
  Palette,
  Tags,
  Users,
  RefreshCw,
  Coins,
  X,
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

type NavChild = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

type NavItem = NavChild & { children?: NavChild[] }

/**
 * `children` mengubah sebuah entri menjadi grup bertingkat.
 *
 * Parent yang punya `children` TIDAK ikut menjadi tautan — halaman daftar
 * produknya masuk sebagai anak pertama (`Semua Produk`). Kalau parent-nya ikut
 * menaut, satu ketukan berarti berpindah halaman SEKALIGUS membuka/menutup
 * grup, dan tidak ada cara menebak yang mana yang akan terjadi.
 */
const adminNavItems: NavItem[] = [
  { title: "Overview",     url: "/admin",          icon: LayoutDashboard },
  {
    title: "Produk",
    url: "/admin/produk",
    icon: Package,
    children: [
      { title: "Semua Produk",    url: "/admin/produk",        icon: Package },
      { title: "Kategori",        url: "/admin/kategori",      icon: FolderTree },
      { title: "Atribut & Brand", url: "/admin/atribut-brand", icon: Tags },
      { title: "Sinkronisasi",   url: "/admin/sinkronisasi",  icon: RefreshCw },
      { title: "Update Harga",    url: "/admin/harga-accurate", icon: Coins },
    ],
  },
  { title: "PC Builder",   url: "/admin/pc-builder", icon: Cpu },
  { title: "PC Prebuild",  url: "/admin/pc-prebuild", icon: Cpu },
  { title: "Banner Promo", url: "/admin/banner",   icon: Megaphone },
  { title: "Toko & Lokasi", url: "/admin/toko",    icon: Store },
  { title: "Pelanggan",    url: "/admin/pelanggan", icon: Users },
  { title: "Tema",         url: "/admin/theme",    icon: Palette },
  { title: "Logs",         url: "/admin/logs",     icon: ClipboardList },
]

/**
 * `/admin` diperlakukan khusus: tanpa itu, Overview terhitung aktif di SETIAP
 * halaman admin karena semua path diawali `/admin`.
 */
function isUrlActive(pathname: string, url: string): boolean {
  if (url === "/admin") return pathname === "/admin"
  return pathname === url || pathname.startsWith(url + "/")
}

/**
 * Anak yang cocok untuk pathname saat ini — yang TERPANJANG.
 *
 * `/admin/produk` adalah awalan dari `/admin/produk/baru`, jadi memilih
 * kecocokan pertama akan menyorot "Semua Produk" saat form produk baru dibuka.
 */
function activeChildUrl(pathname: string, item: NavItem): string | null {
  if (!item.children) return null
  return (
    item.children
      .filter((child) => isUrlActive(pathname, child.url))
      .sort((a, b) => b.url.length - a.url.length)[0]?.url ?? null
  )
}

/**
 * Identitas yang sedang masuk, diteruskan dari layout panel (Server Component
 * yang sudah memanggil `getCurrentUser()`).
 *
 * Sebelumnya nama dan email di footer sidebar DITULIS MATI sebagai "Admin" /
 * "admin@hnsitcenter.id" — dan itu bukan akun yang sebenarnya dipakai
 * (`admin@hns.com`). Jadi setiap hari staff melihat identitas yang salah di
 * panel yang bisa mengubah data produk dan menghapus akun pelanggan, tepat di
 * tempat orang memastikan "saya sedang masuk sebagai siapa".
 */
type AdminIdentity = { name: string; email: string }

export function AppSidebar({ user }: { user: AdminIdentity }) {
  const pathname = usePathname()
  const { open, toggleSidebar, isMobile, setOpenMobile } = useSidebar()

  /**
   * Di ponsel sidebar adalah lapisan yang menutupi halaman, jadi ia harus
   * menyingkir setelah tautan ditekan.
   *
   * Penutupannya TIDAK boleh dilakukan di dalam `onClick`. `Sheet` memakai
   * `useBackToClose`, yang mendorong satu entri riwayat boneka saat panel
   * dibuka lalu menariknya kembali dengan `history.back()` saat panel ditutup.
   * Navigasi App Router bersifat asinkron — Next.js menunggu muatan RSC dulu
   * sebelum mendorong rute barunya — sehingga saat `onClick` (atau bahkan satu
   * `requestAnimationFrame` sesudahnya) berjalan, boneka itu masih jadi puncak
   * tumpukan. `history.back()` lalu memakan boneka tersebut DAN membatalkan
   * navigasi yang belum sempat dilakukan, dan orang tertahan di halaman semula.
   *
   * Maka penutupannya digantung pada `pathname`: begitu rute barunya benar-
   * benar terpasang, barulah panel ditutup. Saat itu URL sudah berbeda dari
   * yang dicatat `useBackToClose`, jadi penjaganya mengenali perpindahan
   * halaman dan tidak memanggil `history.back()` sama sekali.
   */
  React.useEffect(() => {
    setOpenMobile(false)
    // `setOpenMobile` stabil dari context; sengaja hanya bereaksi pada rute.
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Menekan menu halaman yang SEDANG dibuka tidak mengubah `pathname`, jadi
   * efek di atas tidak pernah menyala dan panel akan menggantung terbuka.
   * Hanya kasus itu yang ditutup langsung di sini — dan justru di kasus ini
   * `history.back()` milik `useBackToClose` memang sudah benar: tidak ada
   * navigasi untuk dibatalkan, dan entri bonekanya perlu dibereskan.
   */
  const handleNavigate = React.useCallback(
    (url: string) => {
      if (isMobile && url === pathname) setOpenMobile(false)
    },
    [isMobile, pathname, setOpenMobile]
  )

  /**
   * HANYA berisi grup yang statusnya diubah sendiri oleh pengguna.
   *
   * Grup yang belum pernah disentuh sengaja tidak dicatat di sini: statusnya
   * DITURUNKAN dari pathname saat render (lihat `isGroupOpen` di bawah),
   * sehingga berpindah ke halaman di dalam grup yang tertutup otomatis
   * membukanya tanpa perlu `useEffect` yang memanggil `setState` — pola yang
   * memicu render bertingkat dan ditolak lint (`react-hooks/set-state-in-effect`).
   */
  const [toggledGroups, setToggledGroups] = React.useState<Record<string, boolean>>({})

  const itemClasses = (isActive: boolean) =>
    `relative flex items-center gap-3 rounded-lg w-full transition-colors duration-150 ${
      open ? "px-3 py-2.5" : "justify-center py-2.5"
    } ${
      isActive
        ? "bg-white/15 text-white font-semibold"
        : "text-blue-100 hover:text-white hover:bg-white/10"
    }`

  return (
    <TooltipProvider delay={0}>
      <Sidebar
        collapsible="icon"
        // Di ponsel panel keluar dari kanan, mengikuti posisi tombol hamburger
        // di `AdminMobileBar`. Desktop tetap kiri (default `side`).
        mobileSide="right"
        style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
        className="admin-sidebar border-r border-white/10 text-white shadow-xl"
      >
        {/* Header */}
        <SidebarHeader
          className="h-[64px] flex flex-row items-center border-b border-white/20 px-4 relative shrink-0 bg-transparent"
        >
          <Link
            href="/admin"
            onClick={() => handleNavigate("/admin")}
            className={`flex items-center gap-3 font-bold text-white hover:opacity-90 transition-opacity w-full min-w-0 ${
              open ? "" : "justify-center"
            }`}
          >
            <div className="bg-white rounded-lg p-1 shrink-0 shadow-sm flex items-center justify-center h-8 w-8">
              <Image src="/images/hns-logo.png" alt="HNS IT Center Logo" width={24} height={24} className="object-contain" priority />
            </div>
            <div
              className={`flex flex-col min-w-0 transition-[opacity,width] duration-150 ease-linear overflow-hidden ${
                open ? "opacity-100 w-auto" : "opacity-0 w-0"
              }`}
            >
              <span className="text-sm font-bold leading-tight truncate">HNS IT Center</span>
              <span className="text-[10px] font-normal text-blue-200">Administrator</span>
            </div>
          </Link>

          {/* Tutup panel — hanya di ponsel. Sheet-nya keluar dari kanan, jadi
              tombolnya duduk di ujung kanan header, sejajar hamburger yang
              memanggilnya di `AdminMobileBar`. */}
          <button
            onClick={() => setOpenMobile(false)}
            className="md:hidden flex items-center justify-center h-9 w-9 shrink-0 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-colors cursor-pointer"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </SidebarHeader>

        {/* Toggle button — slim tab docked to the sidebar edge.
            Desktop saja: di ponsel panel tidak menciut jadi ikon, dan tab ini
            akan menggantung di luar tepi kanan layar. */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex absolute -right-3.5 top-20 z-50 h-7 w-7 items-center justify-center rounded-full bg-white text-[#2166de] border border-black/5 shadow-md hover:bg-blue-50 cursor-pointer transition-colors"
          title={open ? "Tutup sidebar" : "Buka sidebar"}
        >
          <ChevronLeft
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)" }}
          />
        </button>

        {/* Navigation */}
        <SidebarContent className="py-4 px-2">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {adminNavItems.map((item) => {
                  const matchedChild = activeChildUrl(pathname, item)

                  // Terbuka kalau pengguna memang membukanya; kalau belum
                  // pernah disentuh, halaman aktif yang menentukan.
                  const isGroupOpen =
                    toggledGroups[item.title] ?? Boolean(matchedChild)

                  // Parent bergaya aktif hanya saat grupnya TERTUTUP. Kalau
                  // terbuka, anaknya yang menyorot — dua sorotan sekaligus
                  // mengaburkan halaman mana yang sedang dibuka.
                  const isActive = item.children
                    ? Boolean(matchedChild) && !isGroupOpen
                    : isUrlActive(pathname, item.url)

                  if (item.children) {

                    // Sidebar menciut: daftar bertingkat tidak muat di lebar
                    // 4.5rem, jadi grupnya jadi ikon yang menaut ke anak
                    // pertama, dengan tooltip yang menyebut isi grupnya.
                    if (!open) {
                      const collapsedLink = (
                        <Link
                          href={item.children[0].url}
                          onClick={() => handleNavigate(item.children![0].url)}
                          className={itemClasses(Boolean(matchedChild))}
                        >
                          {matchedChild && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white" />
                          )}
                          <item.icon className="h-5 w-5 shrink-0" />
                        </Link>
                      )

                      return (
                        <SidebarMenuItem key={item.title}>
                          <Tooltip>
                            <TooltipTrigger render={collapsedLink} />
                            <TooltipContent side="right" className="font-medium">
                              {item.title}
                              <span className="font-normal opacity-75">
                                {" — "}
                                {item.children.map((c) => c.title).join(", ")}
                              </span>
                            </TooltipContent>
                          </Tooltip>
                        </SidebarMenuItem>
                      )
                    }

                    return (
                      <SidebarMenuItem key={item.title} className="flex-col items-stretch">
                        <button
                          type="button"
                          onClick={() =>
                            setToggledGroups((previous) => ({
                              ...previous,
                              [item.title]: !isGroupOpen,
                            }))
                          }
                          aria-expanded={isGroupOpen}
                          className={`${itemClasses(isActive)} cursor-pointer`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white" />
                          )}
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="font-medium text-sm flex-1 text-left">
                            {item.title}
                          </span>
                          <ChevronDown
                            className="h-4 w-4 shrink-0 transition-transform duration-200"
                            style={{
                              transform: isGroupOpen ? "rotate(0deg)" : "rotate(-90deg)",
                            }}
                          />
                        </button>

                        {/* grid-rows 0fr→1fr: animasi buka-tutup tanpa perlu
                            tahu tinggi isinya. `visibility` ikut dimatikan
                            supaya tautan tersembunyi tidak bisa difokus Tab. */}
                        <div
                          className="grid transition-[grid-template-rows,visibility] duration-200 ease-out"
                          style={{
                            gridTemplateRows: isGroupOpen ? "1fr" : "0fr",
                            visibility: isGroupOpen ? "visible" : "hidden",
                          }}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/15 pl-2">
                              {item.children.map((child) => {
                                const isChildActive = matchedChild === child.url
                                return (
                                  <Link
                                    key={child.url}
                                    href={child.url}
                                    onClick={() => handleNavigate(child.url)}
                                    tabIndex={isGroupOpen ? undefined : -1}
                                    className={`relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                                      isChildActive
                                        ? "bg-white/15 text-white font-semibold"
                                        : "text-blue-100 hover:text-white hover:bg-white/10"
                                    }`}
                                  >
                                    {isChildActive && (
                                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-white" />
                                    )}
                                    <child.icon className="h-4 w-4 shrink-0" />
                                    <span>{child.title}</span>
                                  </Link>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      </SidebarMenuItem>
                    )
                  }

                  const linkEl = (
                    <Link
                      href={item.url}
                      onClick={() => handleNavigate(item.url)}
                      className={itemClasses(isActive)}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-white" />
                      )}
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
            className={`flex items-center gap-3 rounded-lg w-full transition-colors duration-150 text-blue-100 hover:text-white hover:bg-white/10 ${
              open ? "px-3 py-2.5" : "justify-center py-2.5"
            }`}
            title="Ke Toko"
          >
            <Store className="h-5 w-5 shrink-0" />
            {open && <span className="font-medium text-sm">Lihat Toko</span>}
          </Link>
        </div>

        {/* Footer */}
        <SidebarFooter className="p-3 border-t border-white/10">
          <div className={`flex items-center rounded-lg py-1.5 ${open ? "gap-3 px-1.5" : "justify-center"}`}>
            <UserNav name={user.name || user.email} email={user.email} />
            {open && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">
                  {user.name || user.email}
                </span>
                <span className="text-xs text-blue-200 truncate">{user.email}</span>
              </div>
            )}
          </div>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  )
}
