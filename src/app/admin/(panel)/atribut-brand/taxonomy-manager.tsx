"use client"

import * as React from "react"
import { Tags, Boxes } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Hanya TIPE — lihat catatan di `brand-panel.tsx`.
import type { AttributeRow, BrandRow } from "@/lib/api/taxonomy"

import { AttributePanel } from "./attribute-panel"
import { BrandPanel } from "./brand-panel"

type TaxonomyManagerProps = {
  attributes: AttributeRow[]
  brands: BrandRow[]
}

/**
 * Dua tab: Atribut dan Brand.
 *
 * Tab yang aktif disimpan di `?tab=` — bukan state biasa. Setiap aksi di dalam
 * panel memanggil `router.refresh()` setelah server action berhasil, dan tanpa
 * penanda di URL, refresh itu akan melempar admin kembali ke tab pertama tiap
 * kali mereka menghapus atau menambah brand.
 */
export function TaxonomyManager({ attributes, brands }: TaxonomyManagerProps) {
  const [tab, setTab] = React.useState<string>(() => {
    if (typeof window === "undefined") return "atribut"
    return new URLSearchParams(window.location.search).get("tab") === "brand"
      ? "brand"
      : "atribut"
  })

  function handleTabChange(next: string) {
    setTab(next)
    // `replaceState`, bukan navigasi Next: hanya menandai tab yang sedang
    // dibuka. Memakai router akan memicu render ulang server untuk sesuatu
    // yang murni tampilan.
    const url = new URL(window.location.href)
    url.searchParams.set("tab", next)
    window.history.replaceState(null, "", url)
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="atribut" className="gap-2">
          <Tags className="h-4 w-4" />
          Atribut
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {attributes.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="brand" className="gap-2">
          <Boxes className="h-4 w-4" />
          Brand
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {brands.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="atribut" className="mt-6">
        <AttributePanel attributes={attributes} />
      </TabsContent>

      <TabsContent value="brand" className="mt-6">
        <BrandPanel brands={brands} />
      </TabsContent>
    </Tabs>
  )
}
