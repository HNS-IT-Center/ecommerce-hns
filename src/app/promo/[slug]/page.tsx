import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Info } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ShareTargetProvider } from "@/components/layout/share-target-provider"
import { PromoHero } from "@/features/promo/components/promo-hero"
import { PromoInfoCard } from "@/features/promo/components/promo-info-card"
import { PromoProductGrid } from "@/features/promo/components/promo-product-grid"
import { PromoTeaserGrid } from "@/features/promo/components/promo-teaser-grid"
import { getLivePromos, getPromoBySlug, getPromoProducts } from "@/lib/api/promos"
import { mapWooProductToUI } from "@/lib/api/woocommerce/mapper"
import { getStockDisplayMode } from "@/lib/api/stock-display"
import { cn } from "@/lib/utils"
import { promoHref, promoPhase } from "@/lib/utils/promo"
import { resolveSiteUrl } from "@/lib/utils/site-url"

type PromoPageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PromoPageProps): Promise<Metadata> {
  const { slug } = await params
  const promo = await getPromoBySlug(slug)
  if (!promo) return { title: "Promo tidak ditemukan" }

  const ended = promoPhase(promo) === "ended"
  return {
    title: promo.title,
    description: promo.description?.slice(0, 160) ?? `${promo.title} — promo HNS IT Center Batam.`,
    alternates: { canonical: promoHref(promo.slug) },
    // Promo yang sudah lewat tetap bisa dibuka (tautan lama di WhatsApp tidak
    // patah), tapi tidak perlu tampil di hasil pencarian.
    ...(ended && { robots: { index: false } }),
    openGraph: {
      images: promo.bannerImageUrl ? [promo.bannerImageUrl] : [],
    },
  }
}

/**
 * Halaman promo — tujuan klik banner beranda. Lihat docs/20-halaman-promo.md.
 *
 * Status (belum mulai / berlangsung / berakhir) dihitung di sini per
 * permintaan, di luar cache data. Harga produk datang dari katalog apa adanya
 * (CLAUDE.md §2.7): jadwal promo tidak pernah mengubah angka harga.
 */
export default async function PromoPage({ params }: PromoPageProps) {
  const { slug } = await params
  const promo = await getPromoBySlug(slug)
  if (!promo) notFound()

  const phase = promoPhase(promo)
  const [products, stockDisplayMode, livePromos, siteUrl] = await Promise.all([
    getPromoProducts(promo),
    getStockDisplayMode(),
    getLivePromos(),
    resolveSiteUrl(),
  ])
  const cards = products.map((p) => mapWooProductToUI(p, stockDisplayMode))
  const otherPromos = livePromos.filter((p) => p.id !== promo.id)
  const shareUrl = `${siteUrl}${promoHref(promo.slug)}`

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <ShareTargetProvider value={{ title: promo.title, url: shareUrl }}>
        <Header />
      </ShareTargetProvider>
      <main className="min-h-content flex-1">
        <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap py-4 text-xs text-muted-foreground"
          >
            <Link href="/" className="hover:text-foreground">
              Beranda
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/promo" className="hover:text-foreground">
              Promo
            </Link>
            <span aria-hidden="true">/</span>
            <span className="truncate font-semibold text-foreground">{promo.title}</span>
          </nav>

          <PromoHero
            title={promo.title}
            imageUrl={promo.bannerImageUrl}
            imageAlt={promo.bannerAlt}
            phase={phase}
          />

          <PromoInfoCard
            title={promo.title}
            description={promo.description}
            terms={promo.terms}
            startsAt={promo.startsAt}
            endsAt={promo.endsAt}
            phase={phase}
            shareUrl={shareUrl}
          />

          {phase !== "live" && (
            <p
              className={cn(
                "mt-3 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px]",
                phase === "upcoming" ? "bg-primary/10 text-primary" : "bg-muted"
              )}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {phase === "upcoming"
                  ? "Promo belum dimulai. Harga di bawah adalah harga saat ini."
                  : "Promo ini sudah selesai. Harga di bawah adalah harga saat ini."}
                {phase === "ended" && otherPromos.length > 0 && (
                  <>
                    {" "}
                    <a href="#promo-lain" className="font-semibold underline">
                      Lihat promo lain
                    </a>
                  </>
                )}
              </span>
            </p>
          )}

          <section aria-labelledby="promo-products" className="mt-9">
            <div className="mb-3">
              <h2 id="promo-products" className="text-xl font-extrabold tracking-tight md:text-2xl">
                Produk dalam promo
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {cards.length} produk · {cards.filter((p) => p.stock > 0).length} tersedia
              </p>
            </div>

            {cards.length > 0 ? (
              <PromoProductGrid products={cards} />
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                Produk untuk promo ini sedang disiapkan.
              </p>
            )}
          </section>

          {otherPromos.length > 0 && (
            <section id="promo-lain" aria-labelledby="promo-lain-title" className="mt-14 scroll-mt-20">
              <h2 id="promo-lain-title" className="mb-3.5 text-lg font-extrabold tracking-tight">
                Promo lain yang sedang berjalan
              </h2>
              <PromoTeaserGrid promos={otherPromos} />
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
