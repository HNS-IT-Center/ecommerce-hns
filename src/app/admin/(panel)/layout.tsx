import { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"

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
  
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <div className="bg-slate-50 text-slate-950 min-h-screen w-full flex font-sans">
      <SidebarProvider defaultOpen={defaultOpen} style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}>
        <AppSidebar />
        <div className="flex flex-col flex-1 w-full relative z-10 min-w-0">
          {/* Mobile top bar — shown only on mobile, replaces client bottom nav */}
          <AdminMobileBar />

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-4 md:p-8">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}

