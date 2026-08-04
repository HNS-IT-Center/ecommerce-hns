"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel"

export type HeroSlide = {
  id: string
  tag: string | null
  title: string
  subtitle: string | null
  cta: string | null
  href: string | null
  imageUrl: string | null
  bgClass: string
  displayMode: "IMAGE_ONLY" | "IMAGE_TEXT"
}

/**
 * Slide-nya datang dari database (dikelola lewat /admin/banner), bukan lagi
 * ditulis di berkas ini — mengganti promo mingguan tidak lagi menuntut deploy.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  // Number of dots is fixed by our slides, so derive it instead of storing it.
  const count = slides.length

  React.useEffect(() => {
    if (!api) return

    // Update on navigation only. Embla fires "select" on user/auto scroll, so we
    // never need a synchronous setState inside this effect. Dot 0 is active by
    // default (current starts at 0).
    const onSelect = () => setCurrent(api.selectedScrollSnap())
    api.on("select", onSelect)

    return () => {
      api.off("select", onSelect)
    }
  }, [api])

  // Auto-play effect
  React.useEffect(() => {
    if (!api) return
    const interval = setInterval(() => {
      api.scrollNext()
    }, 5000)
    return () => clearInterval(interval)
  }, [api])

  // Tanpa banner aktif, seluruh blok disembunyikan — carousel kosong setinggi
  // 400px di puncak beranda jauh lebih buruk daripada tidak ada sama sekali.
  if (slides.length === 0) return null

  return (
    <div className="relative w-full max-w-7xl mx-auto px-4 md:px-6 mt-6">
      <Carousel setApi={setApi} className="w-full" opts={{ loop: true }}>
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide.id}>
              <div
                className={`relative flex aspect-[2/1] w-full flex-col justify-center rounded-3xl ${slide.bgClass} p-8 md:p-16 text-white shadow-xl overflow-hidden`}
              >
                {slide.imageUrl ? (
                  <>
                    <Image
                      src={slide.imageUrl}
                      alt=""
                      fill
                      priority
                      sizes="(max-width: 1280px) 100vw, 1280px"
                      className="object-cover"
                    />
                    {/* Scrim gelap hanya untuk mode IMAGE_TEXT agar teks terbaca */}
                    {slide.displayMode === "IMAGE_TEXT" && (
                      <div className="absolute inset-0 bg-black/45" />
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
                )}

                {slide.displayMode === "IMAGE_TEXT" && (
                  <div className="relative z-10 max-w-2xl space-y-4">
                    {slide.tag && (
                      <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold tracking-wider backdrop-blur-sm">
                        {slide.tag}
                      </span>
                    )}
                    <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl text-balance">
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p className="text-sm md:text-lg text-white/90">
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.cta && slide.href && (
                      <div className="pt-4">
                        <Link href={slide.href} className="inline-flex h-10 items-center justify-center rounded-full bg-secondary px-8 text-sm font-bold text-brand-green shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                          {slide.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Custom Navigation */}
        <div className="absolute inset-y-0 left-8 md:left-12 hidden sm:flex items-center">
          <button
            onClick={() => api?.scrollPrev()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-sm transition-colors hover:bg-black/40 md:bg-black/20"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        </div>
        <div className="absolute inset-y-0 right-8 md:right-12 hidden sm:flex items-center">
          <button
            onClick={() => api?.scrollNext()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-sm transition-colors hover:bg-black/40 md:bg-black/20"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className="flex h-11 w-11 items-center justify-center"
              aria-label={`Go to slide ${i + 1}`}
            >
              <span
                className={`h-2 rounded-full transition-all ${
                  current === i ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            </button>
          ))}
        </div>
      </Carousel>
    </div>
  )
}
