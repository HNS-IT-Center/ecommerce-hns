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
 * Baris atas versi mobile: Back — Pencarian — (Bagikan) — Keranjang.
 *
 * Pencarian berupa kolom di kebanyakan halaman, dan tombol ikon di halaman
 * produk — lihat catatan di dalam komponen.
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
  const { isEnabled, isTransparent } = useTransparentHeader()

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

      {/* Halaman produk (satu-satunya yang menyalakan header melayang) memakai
          tombol ikon pencarian di samping Bagikan, bukan kolom. Masukan sales:
          kolom yang tersembunyi di puncak lalu baru muncul setelah digulir
          membuat pembeli tidak tahu pencarian ada di sana. Ikon ini terlihat
          sejak awal, termasuk di atas foto. Halaman lain tetap memakai kolom
          di bawah, karena di sana kolom yang langsung terlihat justru yang
          mengajak orang mencari. */}
      {isEnabled ? (
        <>
          <div className="min-w-0 flex-1" />
          <div
            className={cn(
              "shrink-0 rounded-full transition-all duration-300",
              isTransparent && GLASS_BUTTON,
            )}
          >
            <SearchBar variant="icon" />
          </div>
        </>
      ) : (
        // Di halaman selain produk header tidak pernah transparan, jadi
        // kolomnya cukup selalu tampil.
        <div className="min-w-0 flex-1">
          <SearchBar className="w-full max-w-none sm:hidden flex" />
        </div>
      )}

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
