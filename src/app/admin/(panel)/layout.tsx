import { Metadata } from "next"
import { redirect } from "next/navigation"
import { MainNav } from "@/components/admin/main-nav"
import { Search } from "@/components/admin/search"
import { UserNav } from "@/components/admin/user-nav"
import { TriangleAlert } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin panel for HNS IT Center",
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) redirect("/admin/login")

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* We keep the warning for now, though auth is partially implemented */}
      <div className="flex items-center gap-2 bg-destructive px-4 py-2 text-sm font-semibold text-white">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        Admin panel ini sedang dalam tahap pengembangan autentikasi.
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
