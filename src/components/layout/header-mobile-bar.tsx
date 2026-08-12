"use client"

import { Download } from "lucide-react"

import { BackButton } from "./back-button"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { useTransparentHeader } from "./transparent-header-provider"
import { cn } from "@/lib/utils"

/**
 * Baris atas versi mobile: Back — Pencarian — Unduh — Keranjang.
 *
 * Dipisah dari `Header` karena wujudnya bergantung pada gulungan, dan itu butuh
 * state klien — sementara `Header` sendiri Server Component yang mengambil
 * kategori dan tema. Isinya tidak berubah dari sebelumnya; yang baru hanya
 * kemampuan tampil melayang di atas galeri produk.
 */
export function HeaderMobileBar() {
  const { isTransparent } = useTransparentHeader()

  return (
    <div className="flex w-full items-center gap-2 md:hidden">
      {/* Bungkus kaca untuk tombol kembali. Dipasang di pembungkus, bukan di
          BackButton sendiri, supaya komponen itu tetap netral dan bisa dipakai
          halaman lain tanpa membawa gaya khusus halaman produk.

          `[&>button]:hover:bg-transparent` mematikan latar hover bawaan tombol:
          di atas foto, kotak abu-abu yang muncul saat disentuh terlihat seperti
          cacat render, sedangkan lingkaran kacanya sendiri sudah jadi penanda
          area sentuh yang cukup. */}
      <div
        className={cn(
          "shrink-0 rounded-full transition-all duration-300",
          isTransparent &&
            "bg-black/35 text-white backdrop-blur-md [&>button]:text-white [&>button]:hover:bg-transparent [&>button]:hover:text-white",
        )}
      >
        <BackButton />
      </div>

      {/* Kolom pencarian menyusut jadi nol saat header melayang.

          Disembunyikan lewat lebar + opacity, bukan dilepas dari DOM: melepasnya
          akan membuang isi ketikan pembeli setiap kali halaman digulir melewati
          ambang, dan komponennya juga memasang listener history miliknya
          sendiri yang tidak perlu dibongkar-pasang. */}
      <div
        className={cn(
          "min-w-0 transition-all duration-300",
          isTransparent ? "w-0 flex-none overflow-hidden opacity-0" : "flex-1 opacity-100",
        )}
        aria-hidden={isTransparent}
      >
        <SearchBar className="w-full max-w-none sm:hidden flex" />
      </div>

      {/* Saat pencarian menghilang, ruang kosongnya diambil alih di sini supaya
          ketiga tombol tetap terdorong ke kanan. */}
      {isTransparent && <div className="flex-1" aria-hidden="true" />}

      <button
        type="button"
        className={cn(
          "group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300",
          isTransparent
            ? "bg-black/35 text-white backdrop-blur-md"
            : "rounded-md text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        aria-label="Download (Coming soon)"
      >
        <Download className="h-5 w-5" />
        <span className="absolute -bottom-8 right-0 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none z-50">
          Coming soon
        </span>
      </button>

      <div
        className={cn(
          "shrink-0 rounded-full transition-all duration-300",
          isTransparent &&
            "bg-black/35 text-white backdrop-blur-md [&_.cart-target-icon]:text-white [&_.cart-target-icon]:hover:bg-transparent [&_.cart-target-icon]:hover:text-white",
        )}
      >
        <CartBadge />
      </div>
    </div>
  )
}
