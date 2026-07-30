import { Metadata } from "next"
import { MainNav } from "@/components/admin/main-nav"
import { Search } from "@/components/admin/search"
import { UserNav } from "@/components/admin/user-nav"
import { TriangleAlert } from "lucide-react"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin panel for HNS IT Center",
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-white">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Admin panel ini belum ada proteksi login — jangan deploy ke domain publik sebelum autentikasi dibangun.
      </div>
      <div className="border-b bg-background shadow-sm">
        <div className="flex h-16 items-center px-4">
          <MainNav className="mx-6" />
          <div className="ml-auto flex items-center space-x-4">
            <Search />
            <UserNav />
          </div>
        </div>
      </div>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
