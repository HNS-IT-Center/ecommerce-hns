"use client"

import { useCallback, useSyncExternalStore } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ProductCard, type Product } from "@/components/ui/product-card"
import { useCarouselAutoplay } from "@/hooks/use-carousel-autoplay"

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
    /**
     * Geseran kencang boleh melewati beberapa kartu sekaligus.
     *
     * Tanpa ini Embla meredam setiap geseran kuat jadi persis satu snap —
     * `allowedForce()` menggantinya dengan `scrollTarget.byIndex(next)` —
     * sehingga mengibaskan jari sekuat apa pun di daftar 15 produk tetap
     * memindahkan satu kartu. Dengan `skipSnaps`, jarak luncurnya sebanding
     * dengan tenaga geseran, tapi titik berhentinya TETAP di posisi snap
     * (`dragFree` sengaja dibiarkan mati — itu yang membuat kartu berhenti
     * terpotong separuh di tepi).
     */
    skipSnaps: true,
  })


  // `EmblaApi`, bukan `any`: tipenya diturunkan dari `useEmblaCarousel` itu
  // sendiri (pola yang sama dipakai `components/ui/carousel.tsx`), jadi
  // `scrollSnapList()` dan `selectedScrollSnap()` ikut terperiksa compiler.
  /**
   * Berlangganan langsung ke kejadian Embla, BUKAN menyalinnya ke state lewat
   * efek. Pola yang sama sudah dipakai `components/ui/carousel.tsx` — dan
   * komentar di sana menyebut alasan yang persis sama: menyalin lewat efek
   * berarti memanggil setState di dalam badan efek hanya untuk membaca nilai
   * awalnya.
   */
  const subscribeToApi = useCallback(
    (onStoreChange: () => void) => {
      if (!emblaApi) return () => {}
      emblaApi.on("select", onStoreChange)
      emblaApi.on("reInit", onStoreChange)
      return () => {
        emblaApi.off("select", onStoreChange)
        emblaApi.off("reInit", onStoreChange)
      }
    },
    [emblaApi]
  )

  const selectedIndex = useSyncExternalStore(
    subscribeToApi,
    () => emblaApi?.selectedScrollSnap() ?? 0,
    () => 0
  )

  /**
   * Cukup JUMLAHNYA, bukan array-nya.
   *
   * `scrollSnapList()` mengembalikan array baru setiap dipanggil, dan
   * `useSyncExternalStore` membandingkan hasil snapshot dengan `Object.is` —
   * mengembalikan array langsung akan terbaca "selalu berubah" dan memicu
   * render tanpa henti. Yang dipakai komponen ini cuma panjangnya (untuk
   * menggambar titik indikator), jadi angka itu yang dijadikan snapshot.
   */
  const snapCount = useSyncExternalStore(
    subscribeToApi,
    () => emblaApi?.scrollSnapList().length ?? 0,
    () => 0
  )

  // Putar otomatis. Hook-nya yang mengurus jeda saat tab tersembunyi, kursor
  // menggantung di atas daftar, atau pengunjung sedang menggeser sendiri —
  // lihat `use-carousel-autoplay.ts`. Titik indikator berada di dalam root
  // Embla, jadi `containerRef` tidak perlu dioper.
  useCarouselAutoplay(emblaApi, 4000)

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
        {Array.from({ length: snapCount }, (_, index) => (
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
