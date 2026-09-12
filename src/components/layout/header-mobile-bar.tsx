"use client"

import { BackButton } from "./back-button"
import { CartBadge } from "./cart-badge"
import { SearchBar } from "./search-bar"
import { ShareButton } from "./share-button"
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

      {/* Kolom pencarian muncul dengan memudar di tempat — lebarnya tidak ikut
          beranimasi.

          Sebelumnya ia bergerak antara `w-0` dan `flex-1`, jadi setiap kali
          pembeli melewati ambang gulungan kolomnya memanjang ulang dari kiri ke
          kanan. Di halaman produk yang digulir naik-turun, gerakan melar itu
          berulang terus dan menarik mata ke header, padahal yang dibaca pembeli
          ada di bawahnya.

          Sekarang `flex-1` dipegang tetap di kedua keadaan sehingga lebarnya
          sudah final sejak awal, dan hanya `opacity` yang beranimasi. `invisible`
          menyusul setelah pudar supaya kolom yang tak terlihat tidak bisa
          ditekan atau kena fokus keyboard — dan karena ia tetap memesan
          ruangnya, keranjang di kanan tidak lagi bergeser saat pencarian
          muncul-hilang. Ganjalan `flex-1` terpisah yang dulu ada di bawah jadi
          tidak diperlukan lagi.

          Tetap di DOM, bukan dilepas: melepasnya akan membuang isi ketikan
          pembeli setiap kali halaman melewati ambang, dan komponennya memasang
          listener history-nya sendiri yang tidak perlu dibongkar-pasang. */}
      <div
        className={cn(
          "min-w-0 flex-1 transition-opacity duration-300",
          isTransparent ? "invisible opacity-0" : "visible opacity-100",
        )}
        aria-hidden={isTransparent}
      >
        <SearchBar className="w-full max-w-none sm:hidden flex" />
      </div>

      {/* Bagikan, tepat di sebelah keranjang. Hanya muncul di halaman yang
          memasang ShareTargetProvider — di halaman lain komponennya menarik
          diri sendiri dan baris ini kembali seperti semula. */}
      <div
        className={cn(
          "shrink-0 rounded-full transition-all duration-300",
          isTransparent && GLASS_BUTTON,
        )}
      >
        <ShareButton />
      </div>

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
