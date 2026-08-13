import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { logoutAction } from "@/app/admin/login/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UserNavProps = {
  name: string
  email: string
}

/**
 * Inisial dari nama, maksimal dua huruf.
 *
 * Huruf awal, BUKAN `user.image` — mengikuti keputusan yang sudah diambil di
 * `panel-header.tsx`: foto dari sumber luar harus lolos `remotePatterns` di
 * next.config, dan mengizinkan host sembarang demi avatar di panel internal
 * bukan pertukaran yang sepadan. Nama bisa kosong secara teori, jadi ada
 * cadangan di pemanggilnya.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function UserNav({ name, email }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {/*
          Tidak ada `AvatarImage` sama sekali. Sebelumnya src-nya
          `/avatars/01.png` — berkas yang tidak pernah ada di `public/`, jadi
          SETIAP halaman admin menembakkan permintaan 404 sepanjang hari kerja
          staff. Dengan hanya `AvatarFallback`, tidak ada permintaan jaringan
          yang dibuat sama sekali.
        */}
        <Avatar className="h-8 w-8">
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground break-all">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*
          Dulu ada tiga butir hiasan di sini — "Profile", "Settings", dan
          "Log out" — lengkap dengan pintasan papan tik (⇧⌘P, ⌘S, ⇧⌘Q) yang
          tidak satu pun terpasang. Ketiganya tidak melakukan apa-apa saat
          diklik. Menu yang diam saat ditekan lebih buruk daripada menu yang
          tidak ada: staff mengira panelnya rusak.

          Sekarang cuma dua, dan dua-duanya bekerja. "Keluar" memakai
          `logoutAction` yang sama dengan tombol di header panel.
        */}
        <DropdownMenuItem render={<Link href="/admin/akun" />}>Akun Saya</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <form action={logoutAction}>
              <button type="submit" className="w-full text-left">
                Keluar
              </button>
            </form>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
