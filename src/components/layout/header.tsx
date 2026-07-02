import Link from "next/link"
import { Search, ShoppingCart, User } from "lucide-react"

import { Input } from "@/components/ui/input"
import { MegaMenu } from "./mega-menu"

export function Header() {
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
          <MegaMenu />
        </div>

        {/* Search Bar */}
        <div className="flex flex-1 items-center justify-end md:justify-center px-4 lg:px-8">
          <div className="relative w-full max-w-sm hidden sm:flex">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari laptop, komponen PC, gaming gear..."
              className="w-full bg-muted shadow-none appearance-none pl-8 md:w-2/3 lg:w-full rounded-full border-none focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Right Nav (Auth & Cart) */}
        <nav className="flex items-center gap-4">
          <Link href="/login" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
            <User className="h-4 w-4" />
            SSO
          </Link>
          <Link href="/cart" className="relative flex items-center p-2 text-muted-foreground hover:text-foreground transition-colors">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-sale-red text-[10px] font-bold text-white">
              2
            </span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
