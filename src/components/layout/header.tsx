import Link from "next/link"
import Image from "next/image"

import { MegaMenu } from "./mega-menu"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"
import { HeaderMobileBar } from "./header-mobile-bar"
import { HeaderShell, HeaderSpacer } from "./header-shell"
import { getCategories } from "@/lib/api/woocommerce/categories"
import { getThemeSettings } from "@/lib/theme/settings"
import { ChristmasHeaderDecor, ChristmasHeaderPattern } from "@/components/theme/christmas-decor"

export async function Header() {
  // Dua pembacaan ini independen, jadi dijalankan berbarengan — tema tidak perlu
  // menunggu kategori selesai diambil.
  const [categories, theme] = await Promise.all([
    getCategories({ hideEmpty: true, perPage: 100 }),
    getThemeSettings(),
  ])

  const isChristmas = theme.activeChromeThemeId === "christmas"

  return (
    <>
      {/* `theme-chrome` = titik cantol Theme Editor. Token di dalam scope ini
          didefinisikan ulang oleh CSS yang disuntik root layout, dan karena
          custom property diwarisi, seluruh `bg-background`/`text-foreground` di
          dalamnya — termasuk MegaMenu, SearchBar, CartBadge, UserMenu — ikut
          berubah tanpa satu pun className disentuh. */}
      <HeaderShell>
        {isChristmas && <ChristmasHeaderDecor />}
        <div className="container relative z-10 mx-auto flex h-16 items-center px-4 md:px-6">
        {/* Mobile Layout (< md): Back - Search - Download - Cart.
            BackButton menyembunyikan dirinya sendiri di luar halaman detail. */}
        <HeaderMobileBar />

        {/* Desktop Layout (>= md), tidak berubah dari sebelumnya */}
        <div className="hidden w-full items-center md:flex">
          {/* Logo */}
          <Link href="/" className="mr-6 flex items-center shrink-0">
            <Image 
              src="/images/Logo HNS IT Center.png" 
              alt="HNS IT Center Logo" 
              width={160}
              height={49}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <MegaMenu categories={categories} />

          {/* Search Bar */}
          <div className="flex flex-1 items-center justify-center px-4 lg:px-8">
            <SearchBar />
          </div>

          {/* Right Nav (Auth & Cart) */}
          <nav className="flex items-center gap-4">
            <UserMenu />
            <CartBadge />
          </nav>
        </div>
      </div>
    </HeaderShell>
    {/* Spacer to prevent content from jumping under the fixed header.

        Juga jadi jangkar setrip pola salju: header sendiri `fixed`, jadi
        apa pun yang dipasang di dalamnya ikut menempel di layar dan tidak
        pernah tergulung. Spacer ini bagian normal dari aliran halaman, jadi
        setripnya ikut naik saat halaman digulung — persis yang diinginkan. */}
    <HeaderSpacer>
      {isChristmas && <ChristmasHeaderPattern />}
    </HeaderSpacer>
  </>
  )
}
