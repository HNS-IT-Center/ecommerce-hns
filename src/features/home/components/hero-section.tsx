import { getActiveBanners } from "@/lib/api/banners"
import { HeroCarousel } from "./hero-carousel"

/**
 * Pembungkus server untuk hero beranda.
 *
 * Dipisah dari `HeroCarousel` (yang sepenuhnya klien karena memakai Embla)
 * supaya pengambilan datanya tetap di server dan tidak menyeret Prisma ke
 * bundel browser.
 */
export async function HeroSection() {
  const banners = await getActiveBanners()

  return (
    <HeroCarousel
      slides={banners.map((banner) => ({
        id: banner.id,
        tag: banner.tag,
        title: banner.title,
        subtitle: banner.subtitle,
        cta: banner.ctaLabel,
        href: banner.ctaHref,
        imageUrl: banner.imageUrl,
        bgClass: banner.bgClass,
        displayMode: banner.displayMode,
      }))}
    />
  )
}
