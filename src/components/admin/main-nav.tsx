import Link from "next/link"
import { cn } from "@/lib/utils"

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <Link
        href="/admin"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Overview
      </Link>
      <Link
        href="/admin/produk"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Produk
      </Link>
      <Link
        href="/admin/kategori"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Kategori
      </Link>
      <Link
        href="/admin/pc-builder"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        PC Builder Configuration
      </Link>
      <Link
        href="/admin/toko"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        Toko & Lokasi
      </Link>
    </nav>
  )
}
