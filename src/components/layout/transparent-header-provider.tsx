"use client"

import { createContext, useContext, useEffect, useState } from "react"

/**
 * Ambang gulungan sebelum header kembali ke wujud normalnya, dalam piksel.
 *
 * Dipilih jauh lebih pendek dari tinggi galeri supaya header memadat begitu
 * pembeli mulai bergerak — menunggu sampai seluruh gambar terlewat membuat
 * transisinya terasa telat dan tidak terhubung dengan gerakan jari.
 */
const SCROLL_THRESHOLD = 80

type TransparentHeaderValue = {
  /** Halaman ini meminta header melayang di atas kontennya. */
  isEnabled: boolean
  /** Header sedang dalam wujud tembus pandang — aktif DAN belum digulir. */
  isTransparent: boolean
}

/**
 * Mati secara bawaan.
 *
 * Header dipakai di seluruh situs, jadi mode melayang ini harus jadi sesuatu
 * yang diminta halaman secara eksplisit, bukan perilaku yang harus dimatikan
 * satu per satu. Halaman yang tidak membungkus dirinya dengan provider ini
 * membaca nilai di bawah dan tidak berubah sama sekali.
 */
const TransparentHeaderContext = createContext<TransparentHeaderValue>({
  isEnabled: false,
  isTransparent: false,
})

export function useTransparentHeader() {
  return useContext(TransparentHeaderContext)
}

/**
 * Menyalakan header melayang untuk satu halaman, dan memantau gulungan.
 *
 * Dipasang halaman produk di sekeliling Header supaya galeri bisa naik sampai
 * mentok ke puncak layar dengan header mengambang di atasnya. Setelah pembeli
 * menggulir melewati ambang, header kembali ke wujud biasa — solid, bergaris
 * bawah, dan dengan kolom pencarian yang muncul kembali.
 */
export function TransparentHeaderProvider({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    /**
     * Gulungan dibaca lewat rAF, bukan langsung di dalam listener.
     *
     * Peristiwa scroll bisa datang berkali-kali dalam satu frame; tanpa gerbang
     * ini setiap satunya memicu perbandingan state dan render React. Menundanya
     * ke frame berikutnya membuat pembacaan terjadi paling banyak sekali per
     * frame, dan itu sudah cukup untuk sesuatu yang murni visual.
     */
    let frame = 0

    const readScroll = () => {
      frame = 0
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD)
    }

    const handleScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(readScroll)
    }

    // Dibaca sekali saat pasang: halaman yang dimuat dalam keadaan sudah
    // tergulir (mis. kembali dari halaman lain, atau tautan ber-anchor) harus
    // langsung menampilkan header padat, bukan menunggu gulungan pertama.
    readScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <TransparentHeaderContext.Provider
      value={{ isEnabled: true, isTransparent: !isScrolled }}
    >
      {children}
    </TransparentHeaderContext.Provider>
  )
}
