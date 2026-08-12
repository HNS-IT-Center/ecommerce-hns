"use client"

import { useRef, useState } from "react"

import { ProductGallery, type GalleryImage } from "./product-gallery"
import { ProductInfo } from "./product-info"
import { ProductVariantStrip, VARIANT_STRIP_ID } from "./product-variant-strip"
import { VARIANT_SELECTOR_ID, type VariantAttribute } from "./product-variant-selector"
import type { ProductVariation } from "@/types/woocommerce"

type ProductDetailProps = {
  images: GalleryImage[]
  videoUrl?: string | null
  /** Indeks galeri untuk tiap varian, dikunci id varian. */
  variantImageIndex: Record<number, number>
  /**
   * Semua yang dibutuhkan panel info kecuali yang dikendalikan komponen ini —
   * pilihan varian dan sorotannya lahir di sini supaya galeri, strip, dan panel
   * bergerak dari satu sumber yang sama.
   */
  info: Omit<
    React.ComponentProps<typeof ProductInfo>,
    | "selected"
    | "onSelectedChange"
    | "onSelectAttribute"
    | "isVariantHighlighted"
    | "onRequestVariantChoice"
    | "className"
  >
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
   * Sorotan sesaat pada pemilih varian, dipicu tombol keranjang di bar
   * mengambang saat variannya belum lengkap.
   *
   * Tinggal di sini, bukan di `ProductInfo`, karena di mobile pemilih variannya
   * sudah pindah ke strip di bawah galeri — di luar jangkauan `ProductInfo`.
   * Keduanya sekarang menyala dari satu penanda yang sama, dan masing-masing
   * hanya terlihat di lebar layarnya sendiri.
   */
  const [isVariantHighlighted, setIsVariantHighlighted] = useState(false)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasVariants =
    info.type === "variable" && info.variantAttributes.length > 0 && info.variations.length > 0

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

  /**
   * Memilih satu atribut. Menekan pilihan yang sedang aktif membatalkannya —
   * harga kembali "mulai dari" dan galeri lepas dari varian itu.
   *
   * Sebelumnya logika ini hanya ada di `ProductInfo`; sekarang strip di bawah
   * galeri juga memanggilnya, jadi tempatnya naik ke induk bersama supaya
   * keduanya benar-benar menjalankan aturan yang sama.
   */
  function handleSelectAttribute(attributeName: string, option: string) {
    if (selected[attributeName] === option) {
      const next = { ...selected }
      delete next[attributeName]
      handleSelectedChange(next)
      return
    }
    handleSelectedChange({ ...selected, [attributeName]: option })
  }

  /**
   * Antar pembeli ke pemilih varian, lalu sorot sebentar.
   *
   * Dipanggil dari bar aksi mengambang di mobile, tempat pemilih variannya
   * berada jauh di atas layar dan sering tidak terlihat sama sekali saat
   * tombol keranjang ditekan. Sasarannya dipilih menurut lebar layar: strip di
   * bawah galeri untuk mobile, panel kanan untuk desktop.
   */
  function handleRequestVariantChoice() {
    const targetId =
      window.innerWidth < 768 ? VARIANT_STRIP_ID : VARIANT_SELECTOR_ID
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" })

    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    setIsVariantHighlighted(true)
    highlightTimer.current = setTimeout(() => setIsVariantHighlighted(false), 2000)
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-12">
      {/* Galeri dan strip varian menempel jadi satu blok di mobile: strip
          berdiri tepat di bawah foto, seperti di aplikasi marketplace. `gap-8`
          milik grid akan menyisipkan celah di antara keduanya, jadi keduanya
          dibungkus satu wadah dengan jarak sendiri yang lebih rapat. */}
      <div className="space-y-4 md:space-y-8">
        <ProductGallery
          images={images}
          videoUrl={videoUrl}
          activeIndexOverride={pendingIndex}
          onActiveIndexChange={handleGalleryIndexChange}
        />

        {hasVariants && (
          <div className="md:hidden">
            <ProductVariantStrip
              attributes={info.variantAttributes}
              variations={info.variations}
              selected={selected}
              onSelect={handleSelectAttribute}
              fallbackImage={info.image}
              isHighlighted={isVariantHighlighted}
            />
          </div>
        )}
      </div>

      {/* Panelnya memasang padding mobile sendiri; galeri di atas sengaja
          dibiarkan menyentuh tepi layar, jadi wadah bersama keduanya tidak bisa
          memasangnya untuk mereka berdua. */}
      <ProductInfo
        className="px-4 md:px-0"
        {...info}
        selected={selected}
        onSelectedChange={handleSelectedChange}
        onSelectAttribute={handleSelectAttribute}
        isVariantHighlighted={isVariantHighlighted}
        onRequestVariantChoice={handleRequestVariantChoice}
      />
    </div>
  )
}

export type { VariantAttribute, ProductVariation }
