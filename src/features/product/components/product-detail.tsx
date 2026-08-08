"use client"

import { useState } from "react"

import { ProductGallery, type GalleryImage } from "./product-gallery"
import { ProductInfo } from "./product-info"
import type { VariantAttribute } from "./product-variant-selector"
import type { ProductVariation } from "@/types/woocommerce"

type ProductDetailProps = {
  images: GalleryImage[]
  videoUrl?: string | null
  /** Indeks galeri untuk tiap varian, dikunci id varian. */
  variantImageIndex: Record<number, number>
  info: Omit<React.ComponentProps<typeof ProductInfo>, "selected" | "onSelectedChange">
}

/**
 * Menyatukan galeri dan panel informasi supaya keduanya berbagi satu pilihan
 * varian.
 *
 * Sebelumnya keduanya bersaudara di Server Component, jadi tidak ada tempat
 * untuk state bersama — memilih warna tidak bisa menggeser galeri, dan
 * menggulir galeri tidak bisa mengubah harga. Pembungkus tipis ini memberi
 * keduanya satu sumber kebenaran tanpa memindahkan pengambilan data ke klien.
 */
export function ProductDetail({ images, videoUrl, variantImageIndex, info }: ProductDetailProps) {
  const [selected, setSelected] = useState<Record<string, string>>({})

  /**
   * Slide yang diminta pilihan varian, sekali jalan.
   *
   * Memilih varian MELOMPATKAN galeri, tapi tidak menguncinya di sana — setelah
   * lompatannya terjadi, penanda ini dilepas supaya pembeli bebas menggeser ke
   * foto lain tanpa tertarik balik. Sebelumnya indeksnya diikat terus ke varian
   * terpilih, dan galeri jadi tidak bisa digeser sama sekali.
   */
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)

  /**
   * Menggulir galeri TIDAK mengubah pilihan varian.
   *
   * Melihat-lihat foto adalah menjelajah, bukan memilih: pembeli yang sudah
   * menetapkan "PUTIH" lalu menggeser ke foto lain tidak bermaksud membatalkan
   * pilihannya, dan membiarkan galeri mengubah harga/stok di panel kanan
   * membuat pilihan terasa hilang sendiri.
   *
   * Yang dilakukan di sini hanya melepas kendali indeks, supaya lompatan dari
   * pemilihan varian bersifat sekali jalan dan galeri bebas digeser sesudahnya.
   * Arah sebaliknya (memilih varian → galeri melompat) tetap berlaku.
   */
  function handleGalleryIndexChange() {
    setPendingIndex(null)
  }

  /**
   * Memilih varian melompatkan galeri ke fotonya. Menekan tombol yang sama lagi
   * membatalkan pilihan itu — harga kembali "mulai dari" dan galeri bebas.
   */
  function handleSelectedChange(next: Record<string, string>) {
    setSelected(next)

    const owner = info.variations.find((variation) =>
      info.variantAttributes.every((attr) => {
        const chosen = next[attr.name]
        if (!chosen) return false
        const match = variation.attributes.find(
          (a) => a.name.trim().toLowerCase() === attr.name.trim().toLowerCase(),
        )
        return match?.option.trim().toLowerCase() === chosen.trim().toLowerCase()
      }),
    )

    const target = owner ? variantImageIndex[owner.id] : undefined
    setPendingIndex(target ?? null)
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      <ProductGallery
        images={images}
        videoUrl={videoUrl}
        activeIndexOverride={pendingIndex}
        onActiveIndexChange={handleGalleryIndexChange}
      />
      <ProductInfo {...info} selected={selected} onSelectedChange={handleSelectedChange} />
    </div>
  )
}

export type { VariantAttribute, ProductVariation }
