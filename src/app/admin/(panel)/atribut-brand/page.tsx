import type { Metadata } from "next"

import { getAttributes, getBrandsWithCount } from "@/lib/api/taxonomy"
import { requirePageView } from "@/lib/auth"
import { TaxonomyManager } from "./taxonomy-manager"

export const metadata: Metadata = {
  title: "Atribut & Brand",
  robots: { index: false, follow: false },
}

export default async function AtributBrandPage() {
  await requirePageView("atribut-brand")
  const [attributes, brands] = await Promise.all([getAttributes(), getBrandsWithCount()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atribut &amp; Brand</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola atribut produk beserta nilainya, dan daftar brand.
        </p>
      </div>

      <TaxonomyManager attributes={attributes} brands={brands} />
    </div>
  )
}
