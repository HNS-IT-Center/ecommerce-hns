import type { Metadata } from "next"
import Link from "next/link"
import { TriangleAlert, LayoutDashboard, Package, Store, FileText, FolderTree } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin — HNS IT Center",
  robots: { index: false, follow: false },
}

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/produk", label: "Produk", icon: Package },
  { href: "/admin/kategori", label: "Kategori", icon: FolderTree },
  { href: "/admin/toko", label: "Toko & Lokasi", icon: Store },
  { href: "/admin/kebijakan", label: "Kebijakan & FAQ", icon: FileText },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-white">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Admin panel ini belum ada proteksi login — jangan deploy ke domain publik sebelum autentikasi dibangun.
      </div>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:block">
          <nav className="flex flex-col gap-1 p-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
