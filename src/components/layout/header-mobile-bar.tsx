"use client"

import { BackButton } from "./back-button"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { useTransparentHeader } from "./transparent-header-provider"
import { cn } from "@/lib/utils"

/**
 * Kelas untuk tombol yang sedang melayang di atas foto produk.
 *
 * Lingkaran kaca gelap dipakai supaya ikon putih tetap terbaca di atas foto
 * apa pun — produk di katalog ini kebanyakan berlatar putih, dan ikon polos
 * tanpa alas akan hilang sama sekali di sana. Latar hover bawaan tiap tombol
 * ikut dimatikan: kotak abu-abu yang muncul saat disentuh terlihat seperti
 * cacat render di atas gambar, sedangkan lingkarannya sendiri sudah jadi
 * penanda area sentuh yang cukup.
 */
const GLASS_BUTTON =
  "bg-black/35 text-white backdrop-blur-md [&_button]:text-white [&_button]:hover:bg-transparent [&_button]:hover:text-white"

/**
 * Baris atas versi mobile: Back — Pencarian — Keranjang.
 *
 * Dipisah dari `Header` karena wujudnya bergantung pada gulungan, dan itu butuh
 * state klien — sementara `Header` sendiri Server Component yang mengambil
 * kategori dan tema.
 *
 * Tidak ada tombol menu di sini: navigasi utama mobile hidup di `MobileDock`
 * yang menempel di bawah layar (Home / PC Build / Shop / Cart / Akun), dan
 * penelusuran kategori dilakukan lewat filter di `/shop`. Bilah atas yang
 * sempit ini cukup memuat yang berkaitan dengan halaman yang sedang dibuka.
 */
export function HeaderMobileBar() {
  const { isTransparent } = useTransparentHeader()

  return (
    <div className="flex w-full items-center gap-2 md:hidden">
      {/* Bungkus kaca dipasang di pembungkus, bukan di komponen tombolnya,
          supaya masing-masing tetap netral dan bisa dipakai halaman lain tanpa
          membawa gaya khusus halaman produk. */}
      <div
        className={cn(
          "shrink-0 rounded-full transition-all duration-300",
          isTransparent && GLASS_BUTTON,
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
          keranjang tetap terdorong ke kanan. */}
      {isTransparent && <div className="flex-1" aria-hidden="true" />}

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
