import Link from "next/link"
import { LogOut } from "lucide-react"
import type { AdminUser } from "@/lib/auth"
import { logoutAction } from "../login/actions"

/**
 * Header panel admin: menunjukkan siapa yang sedang masuk, dan menyediakan
 * jalan keluar.
 *
 * Sengaja ditaruh di header, BUKAN di dalam sidebar. Sidebar adalah
 * `hidden md:block` — kalau tombol keluar ikut di sana, siapa pun yang membuka
 * /admin dari ponsel akan terkunci di dalam sesi yang berumur tujuh hari tanpa
 * cara mengakhirinya selain menghapus cookie sendiri. Header ini tampil di
 * semua ukuran layar, jadi tombolnya tidak pernah menjadi tombol yang mati.
 *
 * Ini Server Component. Tidak ada `"use client"`, tidak ada state: keluar
 * adalah satu POST tanpa cabang, jadi `<form action={logoutAction}>` sudah
 * cukup dan panel tidak perlu mengirim JavaScript tambahan hanya untuk ini.
 *
 * Header ini bukan navigasi mobile — itu pekerjaan terpisah yang belum
 * dikerjakan. Tautan "HNS Admin" mengarah ke dashboard, dan dashboard sudah
 * memuat kartu ke seluruh modul, jadi dari ponsel masih ada jalan berpindah
 * halaman lewat sana.
 */
export function PanelHeader({ user }: { user: AdminUser }) {
  // Huruf awal, bukan `user.image`. Foto dari sumber luar harus lolos
  // `remotePatterns` di next.config, dan mengizinkan host sembarang demi avatar
  // di panel internal bukan pertukaran yang sepadan. Nama bisa kosong secara
  // teori, jadi email dipakai sebagai cadangan.
  const initial = (user.name || user.email).charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 md:px-6">
      <Link href="/admin" className="text-sm font-bold transition-colors hover:text-primary">
        HNS <span className="font-medium text-muted-foreground">Admin</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {/*
          Identitasnya sekaligus tautan ke halaman akun. Itu satu-satunya jalan
          masuk ke sana, dan karena header ini tampil di semua ukuran layar,
          jalan itu ikut bekerja di ponsel — beda dengan sidebar yang `hidden`
          di bawah `md`.
        */}
        <Link
          href="/admin/akun"
          className="flex items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-muted sm:px-2"
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary"
          >
            {initial}
          </span>

          {/*
            `sr-only sm:not-sr-only`, bukan `hidden sm:block`. Di layar sempit
            identitasnya memang tidak ditampilkan supaya header tetap ringkas,
            tapi menyembunyikannya dengan `hidden` berarti pembaca layar juga
            kehilangan informasi "sedang masuk sebagai siapa" — padahal di panel
            yang bisa mengubah data produk, itu justru yang perlu dipastikan
            sebelum menekan apa pun. Di sini `sr-only` juga menjadi nama
            aksesibel tautannya, jadi di ponsel pun tautan ini tidak pernah
            menjadi tautan tanpa nama.
          */}
          <span className="sr-only leading-tight sm:not-sr-only">
            <span className="block max-w-[14rem] truncate text-sm font-semibold">{user.name}</span>
            <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
        </Link>

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Keluar</span>
          </button>
        </form>
      </div>
    </header>
  )
}
