"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ProductCard, type Product } from "@/components/ui/product-card"

type Tab = {
  id: string
  label: string
}

type NewItemsTabsClientProps = {
  tabs: Tab[]
  productsByTab: Record<string, Product[]>
}

export function NewItemsTabsClient({ tabs, productsByTab }: NewItemsTabsClientProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "")

  const products = productsByTab[activeTab] ?? []

  return (
    <section className="mx-auto w-full max-w-7xl px-4 md:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Produk Terbaru
          </h2>
          <div className="hidden sm:flex items-center gap-2 bg-muted p-1 rounded-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeTab === tab.id
                    ? "bg-sale-red text-white"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <Link
          href="/shop"
          className="text-sm font-semibold text-sale-red hover:text-sale-red/80 flex items-center gap-1 transition-colors"
        >
          Lihat semua <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Mobile tabs scrollable */}
      <div className="flex sm:hidden overflow-x-auto pb-4 mb-4 gap-2 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
              activeTab === tab.id
                ? "bg-sale-red text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {products.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            Belum ada produk di kategori ini.
          </div>
        )}
      </div>
    </section>
  )
}
