import { Suspense } from "react"
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/features/home/components/hero-section"
import { TrustBar } from "@/features/home/components/trust-bar"
import { DealsSection } from "@/features/home/components/deals-section"
import { NewItemsTabs } from "@/features/home/components/new-items-tabs"
import { BrandPartners } from "@/features/home/components/brand-partners"
import { SectionSkeleton } from "@/components/ui/section-skeleton"

/**
 * Canonical HANYA dipasang di sini, bukan di root layout.
 *
 * Metadata induk diwarisi anak yang tidak menimpanya, jadi `alternates` di
 * layout akan membuat SETIAP halaman mengaku sebagai salinan beranda — cara
 * tercepat menghilangkan halaman produk dari hasil pencarian. Halaman yang
 * butuh canonical menetapkannya sendiri, seperti `/product/[slug]`.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <Header />
      <main className="flex-1">
        {/* Beranda sebelumnya tidak punya <h1> sama sekali — judul terbesarnya
            adalah <h2> milik slide banner, yang isinya berganti tiap promo.
            Mesin pencari membaca h1 sebagai "halaman ini tentang apa", dan
            beranda toko ini menjawabnya dengan teks promo yang berubah-ubah.

            Ditulis `sr-only` (terbaca pembaca layar & crawler, tidak terlihat)
            karena banner utama sudah menjadi judul visual halaman ini; menaruh
            judul kedua yang terlihat di atasnya akan mendorong banner turun
            tanpa memberi tahu pengunjung apa pun yang belum mereka lihat. */}
        <h1 className="sr-only">
          HNS IT Center Batam — Toko Komputer, Laptop, PC Gaming &amp; Aksesoris
        </h1>
        <Suspense fallback={<div className="mx-auto mt-6 h-[300px] w-full max-w-7xl animate-pulse rounded-3xl bg-muted px-4 sm:h-[350px] md:h-[400px] md:px-6" />}>
          <HeroSection />
        </Suspense>
        <TrustBar />
        <Suspense fallback={<SectionSkeleton count={6} />}>
          <DealsSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton count={6} />}>
          <NewItemsTabs />
        </Suspense>
        <BrandPartners />
      </main>
      <Footer />
    </div>
  )
}
