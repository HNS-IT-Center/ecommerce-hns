import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { logoutAction } from "@/app/admin/login/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type UserNavProps = {
  name: string
  email: string
  /** Foto profil dari `users.image`, atau `null` kalau belum pernah diunggah. */
  image: string | null
}

/**
 * Inisial dari nama, maksimal dua huruf. Dipakai kalau fotonya belum ada — atau
 * gagal dimuat.
 *
 * Nama bisa kosong secara teori, jadi ada cadangan di pemanggilnya.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function UserNav({ name, email, image }: UserNavProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative flex h-8 w-8 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {/*
          `AvatarImage` HANYA kalau ada fotonya. Sebelumnya src-nya dipasang
          tanpa syarat ke `/avatars/01.png` — berkas yang tidak pernah ada di
          `public/`, jadi SETIAP halaman admin menembakkan permintaan 404
          sepanjang hari kerja staff. Itu yang dulu diperbaiki dengan membuang
          `AvatarImage` sama sekali; syarat di bawah menjaga perbaikan itu
          sambil tetap menampilkan foto yang memang ada. Akun tanpa foto tetap
          tidak membuat satu permintaan jaringan pun.
        */}
        <Avatar className="h-8 w-8">
          {image && <AvatarImage src={image} alt="" />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        {/* Div biasa, bukan `DropdownMenuLabel`: label itu memakai
            `MenuPrimitive.GroupLabel` yang WAJIB berada di dalam
            `MenuPrimitive.Group`. Dipakai lepas di sini, ia melempar
            "MenuGroupContext is missing" dan menu (termasuk tombol Keluar)
            tidak pernah muncul. Nama+email cuma teks — tak butuh semantik itu. */}
        <div className="px-2 py-1.5">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground break-all">{email}</p>
          </div>
        </div>
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
