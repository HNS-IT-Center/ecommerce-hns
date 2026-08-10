"use client"

import { useRouter, usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

/**
 * Awalan rute yang punya "induk" — halaman detail yang selalu dicapai dari
 * suatu daftar. Halaman tingkat atas (`/`, `/shop`, `/cart`, `/account`) tidak
 * masuk daftar ini: tidak ada yang lebih tinggi untuk dituju, dan tombol back
 * di sana hanya membingungkan.
 */
const DETAIL_ROUTE_PREFIXES = ["/product/", "/blog/", "/category/", "/kebijakan/", "/verify/"]

/** Tujuan cadangan saat tidak ada riwayat untuk dimundurkan. */
const FALLBACK_HREF = "/shop"

export function BackButton() {
  const router = useRouter()
  const pathname = usePathname()

  const isDetailRoute = DETAIL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (!isDetailRoute) return null

  /**
   * Mundur satu langkah, dengan syarat langkah itu masih di dalam situs ini.
   *
   * Inti permintaannya: pembeli yang datang dari hasil filter harus kembali ke
   * filter itu — bukan ke katalog yang tereset. `router.back()` melakukan itu
   * karena mengembalikan entri riwayat berikut querystring-nya.
   *
   * Tapi `back()` sendirian berbahaya untuk pengunjung dari Google atau tautan
   * WhatsApp: riwayatnya kosong, dan tombolnya justru melempar mereka keluar
   * dari situs. `history.length <= 1` menandai kasus itu — tab yang dibuka
   * langsung ke halaman ini — dan di situ kita antar ke katalog saja.
   */
  const handleBack = () => {
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(FALLBACK_HREF)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Kembali ke halaman sebelumnya"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  )
}
