"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogIn, LogOut, User, Wrench } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCustomer } from "@/hooks/use-customer"

type AccountNavProps = {
  logoutAction: () => Promise<void>
}

/**
 * Menu akun di header desktop. Guest melihat satu tautan "Masuk"; pelanggan
 * yang sudah login melihat avatar inisial (BUKAN foto — Sprint 1 sengaja
 * tidak menyimpan foto profil Google) yang membuka dropdown.
 *
 * Dropdown-nya sengaja HANYA berisi "Rakitan Tersimpan" dan "Keluar" — tidak
 * ada aksi hapus akun di sini. Keputusan 2026-08-11: penghapusan akun
 * pelanggan bukan alur self-service, hanya lewat staff via admin/WhatsApp
 * (lihat baris "Ingin menghapus akun?" di halaman /akun). Menaruh aksi
 * destruktif permanen satu klik dari dropdown yang sering dibuka bukan
 * pertukaran yang sepadan.
 */
export function AccountNav({ logoutAction }: AccountNavProps) {
  const router = useRouter()
  const { customer } = useCustomer()

  // Selama fetch /api/auth/me belum selesai, dan saat memang guest, tampilan
  // sama — tautan "Masuk". Tidak ada skeleton/spinner terpisah untuk keadaan
  // loading: perbedaannya cuma sesaat, dan berkedip dari "Masuk" ke avatar
  // terasa lebih wajar daripada dari skeleton ke salah satu dari keduanya.
  if (!customer) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
      >
        <LogIn className="h-4 w-4" />
        Masuk
      </Link>
    )
  }

  const initial = customer.name.charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-muted">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green"
        >
          {initial}
        </span>
        <span className="max-w-[8rem] truncate text-sm font-semibold">{customer.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {/* `DropdownMenuLabel` (Base UI `Menu.GroupLabel`) mewajibkan
            `Menu.Group` sebagai leluhurnya — tanpa itu melempar
            "MenuGroupContext is missing" di setiap render. Bukan untuk
            mengelompokkan item yang bisa dipilih; label ini murni
            informatif (nama/email), jadi grup hanya membungkusnya sendiri. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1.5">
            <span className="block truncate text-sm font-semibold text-foreground">{customer.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/akun")}>
          <Wrench className="h-4 w-4" />
          Rakitan Tersimpan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void logoutAction()
          }}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Dipakai kalau suatu saat perlu ikon generik tanpa inisial (mis. loading state). */
export function AccountIcon({ className }: { className?: string }) {
  return <User className={className} />
}
