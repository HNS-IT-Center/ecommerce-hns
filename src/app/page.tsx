import { Suspense } from "react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroSection } from "@/features/home/components/hero-section"
import { TrustBar } from "@/features/home/components/trust-bar"
import { DealsSection } from "@/features/home/components/deals-section"
import { NewItemsTabs } from "@/features/home/components/new-items-tabs"
import { BrandPartners } from "@/features/home/components/brand-partners"
import { SectionSkeleton } from "@/components/ui/section-skeleton"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
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
