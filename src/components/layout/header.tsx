import Link from "next/link"

import { Download } from "lucide-react"

import { MegaMenu } from "./mega-menu"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"
import { getCategories } from "@/lib/api/woocommerce/categories"

export async function Header() {
  const categories = await getCategories({ hideEmpty: true, perPage: 100 })

  return (
    <>
      <header className="fixed top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
        {/* Mobile Layout (< md): Search - Download - Cart */}
        <div className="flex w-full items-center gap-2 md:hidden">
          <div className="flex-1">
            <SearchBar className="w-full max-w-none sm:hidden flex" />
          </div>
          
          <button 
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground group relative shrink-0"
            aria-label="Download (Coming soon)"
          >
            <Download className="h-5 w-5" />
            <span className="absolute -bottom-8 right-0 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-50">
              Coming soon
            </span>
          </button>
          
          <div className="shrink-0">
            <CartBadge />
          </div>
        </div>

        {/* Desktop Layout (>= md), tidak berubah dari sebelumnya */}
        <div className="hidden w-full items-center md:flex">
          {/* Logo */}
          <Link href="/" className="mr-6 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-green text-primary-foreground font-bold">
              H
            </div>
            <span className="hidden font-bold sm:inline-block">
              HNS IT Center
            </span>
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
    </header>
    {/* Spacer to prevent content from jumping under the fixed header */}
    <div className="h-16 w-full" />
  </>
  )
}
