"use client"

import { useEffect, useState, useCallback } from "react"
import useEmblaCarousel, { type UseEmblaCarouselType } from "embla-carousel-react"
import { ProductCard, type Product } from "@/components/ui/product-card"

// Instance API Embla. `UseEmblaCarouselType[1]` bisa `undefined` (sebelum
// carousel siap), tapi kedua callback di bawah hanya dipanggil setelah
// `emblaApi` dipastikan ada — jadi `NonNullable` di sini jujur, bukan paksaan.
type EmblaApi = NonNullable<UseEmblaCarouselType[1]>

interface DealsCarouselProps {
  products: Product[]
}

/**
 * Berapa kartu pertama yang gambarnya dimuat tanpa menunggu (lihat prop
 * `priority` di ProductCard).
 *
 * Enam mengikuti kelas lebar terpadat di bawah (`xl:w-1/6`) — jumlah kartu yang
 * muat dalam satu baris di layar terlebar, jadi di viewport mana pun angka ini
 * menutupi persis yang terlihat tanpa menggulir. Layar yang lebih sempit
 * menampilkan lebih sedikit kartu per baris, sehingga sisanya memang di luar
 * layar; itu tetap jauh lebih murah daripada menandai seluruh daftar.
 *
 * Section ini yang pertama muncul setelah hero di beranda, jadi kartu-kartu
 * inilah kandidat LCP-nya.
 */
const ABOVE_FOLD_COUNT = 6

export function DealsCarousel({ products }: DealsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    slidesToScroll: 1,
  })

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([])

  // `EmblaApi`, bukan `any`: tipenya diturunkan dari `useEmblaCarousel` itu
  // sendiri (pola yang sama dipakai `components/ui/carousel.tsx`), jadi
  // `scrollSnapList()` dan `selectedScrollSnap()` ikut terperiksa compiler.
  const onInit = useCallback((api: EmblaApi) => {
    setScrollSnaps(api.scrollSnapList())
  }, [])

  const onSelect = useCallback((api: EmblaApi) => {
    setSelectedIndex(api.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!emblaApi) return

    onInit(emblaApi)
    onSelect(emblaApi)
    emblaApi.on("reInit", onInit).on("reInit", onSelect).on("select", onSelect)

    const interval = setInterval(() => {
      emblaApi.scrollNext()
    }, 4000)

    return () => clearInterval(interval)
  }, [emblaApi, onInit, onSelect])

  return (
    <div className="overflow-hidden pb-4" ref={emblaRef}>
      <div className="flex touch-pan-y -ml-4">
        {products.map((product, index) => (
          <div key={product.id} className="min-w-0 flex-none pl-4 w-1/2 md:w-1/4 lg:w-1/5 xl:w-1/6">
            <ProductCard product={product} priority={index < ABOVE_FOLD_COUNT} />
          </div>
        ))}
      </div>
      
      <div className="mt-8 flex justify-center gap-2">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            onClick={() => emblaApi?.scrollTo(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === selectedIndex ? "w-6 bg-brand-green" : "w-2 bg-border hover:bg-muted-foreground/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
