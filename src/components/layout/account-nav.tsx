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
 * (lihat baris "Ingin menghapus akun?" di halaman /profile). Menaruh aksi
 * destruktif permanen satu klik dari dropdown yang sering dibuka bukan
 * pertukaran yang sepadan.
 */
export function AccountNav({ logoutAction }: AccountNavProps) {
  const router = useRouter()
  const { loading, customer } = useCustomer()

  // Selama fetch /api/auth/me belum selesai, JANGAN merender "Masuk".
  //
  // Sebelumnya keadaan loading dan keadaan guest dirender identik, dengan
  // alasan "perbedaannya cuma sesaat". Ternyata tidak: di koneksi nyata
  // pelanggan yang sudah login melihat "Masuk" lebih dulu, baru berganti jadi
  // namanya. Header memberi tahu orang bahwa ia belum login padahal sudah —
  // itu keliru, bukan sekadar berkedip.
  //
  // Placeholder ini sengaja tidak membawa teks maupun tautan: selama status
  // belum diketahui, satu-satunya jawaban jujur adalah "belum tahu". Ukurannya
  // dikunci menyerupai trigger avatar supaya lebar nav tidak melompat saat
  // status akhirnya masuk.
  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="flex items-center gap-2 px-1.5 py-1.5"
      >
        <span className="size-7 shrink-0 animate-pulse rounded-full bg-muted" />
        <span className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    )
  }

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
      {/* `max-h-[min(--available-height,70svh)]` + `overscroll-contain`
          sengaja ditaruh di sini, BUKAN di `ui/dropdown-menu.tsx`: hanya
          dropdown profil ini yang bermasalah, dan dropdown admin
          (user-nav, category-manager) sekarang sudah berperilaku benar —
          tidak ada gunanya mengubah perilaku mereka.

          `svh` dipakai supaya batasnya mengikuti tinggi layar yang benar-benar
          terlihat di mobile, bukan tinggi termasuk bilah URL yang menghilang.
          `overscroll-contain` menahan gulir agar berhenti di ujung popup dan
          tidak diteruskan ke <body> yang sedang dikunci Base UI saat menu
          terbuka — tanpa itu, isi yang meluap tidak bisa digulir sama sekali. */}
      <DropdownMenuContent
        align="end"
        className="max-h-[min(var(--available-height),70svh)] min-w-56 overscroll-contain"
      >
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
        <DropdownMenuItem onClick={() => router.push("/profile")}>
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
