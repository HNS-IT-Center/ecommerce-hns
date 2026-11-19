import type { Metadata } from "next"

import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PromoTeaserGrid } from "@/features/promo/components/promo-teaser-grid"
import { getLivePromos } from "@/lib/api/promos"

export const metadata: Metadata = {
  title: "Promo",
  description: "Promo yang sedang berjalan di HNS IT Center Batam.",
  alternates: { canonical: "/promo" },
}

/** Semua promo yang sedang berlangsung — tujuan breadcrumb "Promo". */
export default async function PromoIndexPage() {
  const promos = await getLivePromos()

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <Header />
      <main className="min-h-content flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <header className="mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Promo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Promo yang sedang berjalan saat ini.</p>
          </header>
          {promos.length > 0 ? (
            <PromoTeaserGrid promos={promos} scroll={false} />
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
              Belum ada promo yang berjalan. Cek lagi nanti.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
