import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LayoutDashboard, Package, Store, FileText, FolderTree } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"
import { PanelHeader } from "./panel-header"

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  /**
   * Penjaga kedua, di belakang middleware.
   *
   * Middleware berjalan di Edge dan hanya bisa memeriksa tanda tangan cookie —
   * ia tidak punya akses database, jadi ia tidak tahu apakah akunnya masih ada.
   * Cookie milik akun yang sudah dihapus akan tetap lolos di sana sampai
   * kedaluwarsa sendiri. Di sinilah pertanyaan itu dijawab: `getCurrentUser`
   * membaca ulang tabel User, dan kalau barisnya sudah tidak ada, sesi ikut
   * kehilangan artinya seketika.
   *
   * Halaman masuk sengaja berada DI LUAR route group ini. Kalau ia ikut
   * dibingkai layout, pengalihan di bawah akan memanggil dirinya sendiri tanpa
   * henti — dan halaman login yang terkunci di belakang login adalah cara
   * paling rapi untuk mengunci diri sendiri di luar rumah.
   */
  if (!user) redirect("/admin/login")

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      {/*
        `user` diteruskan dari sini, tidak dibaca ulang di dalam header.
        `getCurrentUser` menyentuh database setiap kali dipanggil, dan layout
        sudah memanggilnya barusan untuk penjagaan di atas — memanggil lagi
        hanya untuk menampilkan nama berarti dua query untuk satu pertanyaan
        yang sama.
      */}
      <PanelHeader user={user} />

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
