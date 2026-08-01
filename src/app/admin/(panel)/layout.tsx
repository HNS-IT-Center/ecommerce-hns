import { Metadata } from "next"
import { redirect } from "next/navigation"

import { TriangleAlert } from "lucide-react"
import { getCurrentUser } from "@/lib/auth"

import { AppSidebar } from "@/components/admin/app-sidebar"
import { AdminMobileBar } from "@/components/admin/admin-mobile-bar"
import { SidebarProvider } from "@/components/ui/sidebar"

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
    <div className="bg-slate-50 text-slate-950 min-h-screen w-full flex font-sans">
      <SidebarProvider style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full relative z-10 min-w-0">
          {/* Mobile top bar — shown only on mobile, replaces client bottom nav */}
          <AdminMobileBar />

          {/* Warning banner — hidden on mobile to save space */}
          <div className="hidden md:flex items-center justify-center gap-2 bg-rose-500/90 backdrop-blur-sm px-6 py-2 text-sm font-medium text-white w-full max-w-2xl mx-auto rounded-b-2xl shadow-sm z-40">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            Admin panel ini sedang dalam tahap pengembangan autentikasi.
          </div>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 md:p-8">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}

