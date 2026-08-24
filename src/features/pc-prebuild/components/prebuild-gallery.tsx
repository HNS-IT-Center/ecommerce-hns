"use client"

import Image from "next/image"
import { useState, type ReactNode } from "react"

/**
 * Galeri foto rakitan di halaman detail paket.
 *
 * Satu foto besar, sisanya jadi thumbnail yang bisa diklik untuk menukar yang
 * besar. TIDAK ada lightbox: foto rakitan dipakai untuk menilai wujud dan tata
 * kabelnya, dan ukuran besar di halaman sudah cukup untuk itu — lightbox
 * menambah lapisan yang harus ditutup lagi tanpa memberi informasi baru.
 *
 * Berfoto satu tetap rapi: barisan thumbnail-nya tidak dirender sama sekali,
 * bukan menyisakan satu kotak sendirian.
 */
export function PrebuildGallery({
  images,
  nama,
  badge,
}: {
  images: string[]
  nama: string
  /**
   * Penanda yang menempel di sudut foto utama — dipakai flag kelas performa,
   * dengan cara yang sama seperti flag diskon menempel di foto produk.
   *
   * Dioper sebagai node, bukan dirakit di sini: galeri ini tidak perlu tahu
   * apa-apa tentang analisis performa, dan pemanggil yang tidak punya analisis
   * cukup tidak mengirim apa pun.
   */
  badge?: ReactNode
}) {
  const [aktif, setAktif] = useState(0)

  if (images.length === 0) return null

  const utama = images[aktif] ?? images[0]

  return (
    <div className="space-y-3">
      <div className="relative">
        {badge}
        <Image
          src={utama}
          alt={`Foto rakitan ${nama}`}
          width={960}
          height={640}
          priority
          className="aspect-3/2 w-full rounded-2xl border bg-white object-contain"
        />
      </div>

      {images.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setAktif(i)}
              aria-label={`Lihat foto ${i + 1} dari ${images.length}`}
              aria-pressed={i === aktif}
              className={`overflow-hidden rounded-lg border-2 transition-colors ${
                i === aktif ? "border-brand-green" : "border-transparent hover:border-input"
              }`}
            >
              <Image
                src={url}
                alt=""
                width={80}
                height={80}
                className="h-20 w-20 bg-white object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
