import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { HeroCarousel } from "@/features/home/components/hero-carousel"
import { TrustBar } from "@/features/home/components/trust-bar"
import { DealsSection } from "@/features/home/components/deals-section"
import { NewItemsTabs } from "@/features/home/components/new-items-tabs"
import { BrandPartners } from "@/features/home/components/brand-partners"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HeroCarousel />
        <TrustBar />
        <DealsSection />
        <NewItemsTabs />
        <BrandPartners />
      </main>
      <Footer />
    </div>
  )
}
