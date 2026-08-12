"use client"

import { useTransparentHeader } from "./transparent-header-provider"
import { cn } from "@/lib/utils"

/**
 * Membungkus `<header>` supaya latarnya bisa menghilang di atas galeri produk.
 *
 * Hanya latar dan garis bawahnya yang dikendalikan di sini — isi headernya
 * tetap dirakit di Server Component supaya kategori dan tema tidak perlu pindah
 * ke klien.
 */
export function HeaderShell({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const { isTransparent } = useTransparentHeader()

  return (
    <header
      className={cn(
        "theme-chrome fixed top-0 z-50 w-full transition-colors duration-300 print:hidden",
        // Wujud melayang hanya berlaku di mobile; dari `md` ke atas header
        // selalu padat seperti sebelumnya.
        isTransparent
          ? "border-b border-transparent bg-transparent md:border-border md:bg-background/95 md:backdrop-blur md:supports-[backdrop-filter]:bg-background/60"
          : "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      {children}
    </header>
  )
}

/**
 * Ganjalan setinggi header, yang mengempis saat header sedang melayang.
 *
 * Header ber-`fixed` dan tidak memakan ruang dokumen; ganjalan inilah yang
 * biasanya mendorong konten ke bawahnya. Di halaman produk mobile justru itu
 * yang tidak diinginkan — galerinya harus naik sampai menyentuh puncak layar —
 * jadi di sana tingginya dinolkan dan headernya melayang di atas foto.
 */
export function HeaderSpacer({ children }: { children?: React.ReactNode }) {
  const { isTransparent } = useTransparentHeader()

  return (
    <div className={cn("relative w-full", isTransparent ? "h-0 md:h-16" : "h-16")}>
      {children}
    </div>
  )
}
