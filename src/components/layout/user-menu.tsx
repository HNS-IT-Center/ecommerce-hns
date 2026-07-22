"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu } from "@base-ui/react/menu"
import { User, ChevronDown, UserCircle, LogOut } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { useIsHydrated } from "@/hooks/use-is-hydrated"

export function UserMenu() {
  const mounted = useIsHydrated()
  const router = useRouter()
  const { isLoggedIn, user, logout } = useAuthStore()

  if (!mounted) {
    return (
      <Link href="/login" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
        <User className="h-4 w-4" />
        Akun
      </Link>
    )
  }

  if (!isLoggedIn || !user) {
    return (
      <Link href="/login" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
        <User className="h-4 w-4" />
        Masuk / Daftar
      </Link>
    )
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  return (
    <Menu.Root>
      <Menu.Trigger className="hidden items-center gap-2 text-sm font-medium outline-none transition-colors hover:text-brand-green sm:flex">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green/20 text-xs font-bold uppercase text-brand-green">
          {user.name.charAt(0)}
        </div>
        Hi, {user.name}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={8} align="end">
          <Menu.Popup className="min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Menu.Item
              render={<Link href="/account" />}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted"
            >
              <UserCircle className="h-4 w-4" />
              Akun Saya
            </Menu.Item>
            <div className="my-1 h-px bg-border" />
            <Menu.Item
              onClick={handleLogout}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-sale-red outline-none data-highlighted:bg-sale-red/10"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
