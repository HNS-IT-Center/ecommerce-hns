import Link from "next/link"
import { Search, ShoppingCart, User } from "lucide-react"

import { MegaMenu } from "./mega-menu"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { UserMenu } from "./user-menu"
import { getCategories } from "@/lib/api/woocommerce/categories"

export async function Header() {
  const categories = await getCategories({ hideEmpty: true, perPage: 100 })

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4 md:px-6">
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
        <div className="hidden md:flex">
          <MegaMenu categories={categories} />
        </div>

        {/* Search Bar */}
        <div className="flex flex-1 items-center justify-end md:justify-center px-4 lg:px-8">
          <SearchBar />
        </div>

        {/* Right Nav (Auth & Cart) */}
        <nav className="flex items-center gap-4">
          <UserMenu />
          <CartBadge />
        </nav>
      </div>
    </header>
  )
}
