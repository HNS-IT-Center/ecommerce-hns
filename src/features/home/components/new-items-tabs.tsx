"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ProductCard, type Product } from "@/components/ui/product-card"

// Mock data
const mockProducts: Record<string, Product[]> = {
  "laptop": [
    {
      id: "5",
      slug: "asus-rog-strix-g16-2",
      name: "ASUS ROG Strix G16 i7 RTX 4060",
      brand: "ASUS",
      category: "Laptop",
      price: 24500000,
      member_price: 23800000,
      image_url: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&q=80&w=400",
      sold: 82,
      badge: "Hot",
      stock: 10,
      type: "simple",
    },
    {
      id: "6",
      slug: "msi-katana-15",
      name: "MSI Katana 15 i7 13th Gen RTX 4050",
      brand: "MSI",
      category: "Laptop",
      price: 17999000,
      member_price: 17550000,
      image_url: "https://images.unsplash.com/photo-1593642702821-c823b13eb295?auto=format&fit=crop&q=80&w=400",
      sold: 45,
      stock: 5,
      type: "simple",
    },
    {
      id: "7",
      slug: "acer-nitro-v15-2",
      name: "Acer Nitro V15 Ryzen 7 RTX 4050",
      brand: "ACER",
      category: "Laptop",
      price: 15750000,
      member_price: 15200000,
      image_url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&q=80&w=400",
      sold: 120,
      badge: "Deal",
      stock: 15,
      type: "simple",
    },
    {
      id: "8",
      slug: "lenovo-loq-15",
      name: "Lenovo LOQ 15 i5 12th Gen RTX 3050",
      brand: "LENOVO",
      category: "Laptop",
      price: 12500000,
      member_price: 12100000,
      image_url: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?auto=format&fit=crop&q=80&w=400",
      sold: 60,
      stock: 8,
      type: "simple",
    },
  ],
  "pc-components": [],
  "gaming-gear": [],
}

const tabs = [
  { id: "laptop", label: "Laptop" },
  { id: "pc-components", label: "PC Components" },
  { id: "gaming-gear", label: "Gaming Gear" },
]

export function NewItemsTabs() {
  const [activeTab, setActiveTab] = useState("laptop")

  const products = mockProducts[activeTab] || []

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
