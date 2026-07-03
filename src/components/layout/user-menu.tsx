"use client"

import Link from "next/link"
import { User } from "lucide-react"
import { useAuthStore } from "@/store/auth"
import { useEffect, useState } from "react"

export function UserMenu() {
  const [mounted, setMounted] = useState(false)
  const { isLoggedIn, user } = useAuthStore()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Link href="/login" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
        <User className="h-4 w-4" />
        Akun
      </Link>
    )
  }

  if (isLoggedIn && user) {
    return (
      <Link href="/account" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-brand-green transition-colors">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green/20 text-brand-green text-xs font-bold uppercase">
          {user.name.charAt(0)}
        </div>
        Hi, {user.name}
      </Link>
    )
  }

  return (
    <Link href="/login" className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors">
      <User className="h-4 w-4" />
      Masuk / Daftar
    </Link>
  )
}
