"use client"

import { useState, useEffect } from "react"
import { useBuilderStore, BuilderSlot, BuilderItem } from "@/store/builder"
import { formatRupiah } from "@/lib/utils"
import { X, Search, Loader2 } from "lucide-react"
import Image from "next/image"

interface Product {
  id: number
  name: string
  price: string
  images: Array<{ src: string }>
}

interface ComponentSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  slot: BuilderSlot
}

type CompletedFetch = {
  key: string
  products: Product[]
}

export function ComponentSelectionModal({ isOpen, onClose, slot }: ComponentSelectionModalProps) {
  const [search, setSearch] = useState("")
  const [completed, setCompleted] = useState<CompletedFetch | null>(null)

  const selectItem = useBuilderStore((state) => state.selectItem)

  // Kombinasi kategori+pencarian yang identifies hasil fetch saat ini.
  const fetchKey = `${slot.categorySlug}::${search}`

  useEffect(() => {
    if (!isOpen) return

    let isStale = false

    const url = new URL("/api/products", window.location.origin)
    url.searchParams.set("categorySlug", slot.categorySlug)
    if (search) {
      url.searchParams.set("search", search)
    }
    url.searchParams.set("per_page", "20")

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isStale) return
        setCompleted({ key: fetchKey, products: data })
      })
      .catch((error) => {
        console.error("Failed to fetch products", error)
        if (isStale) return
        setCompleted({ key: fetchKey, products: [] })
      })

    return () => {
      isStale = true
    }
  }, [isOpen, fetchKey, slot.categorySlug, search])

  if (!isOpen) return null

  // "loading" adalah nilai turunan: fetch untuk kombinasi kategori+pencarian
  // saat ini belum selesai — bukan setState di badan effect. Pola yang sama
  // dengan use-live-search.ts.
  const loading = !completed || completed.key !== fetchKey
  const products = !loading ? completed.products : []

  const handleSelect = (product: Product) => {
    const item: BuilderItem = {
      id: product.id.toString(),
      name: product.name,
      price: parseInt(product.price || "0", 10),
      image: product.images?.[0]?.src,
    }
    selectItem(slot.id, item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-bold">Pilih {slot.title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Cari ${slot.title}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-input bg-muted/50 py-3 pl-10 pr-4 outline-none transition-colors focus:border-primary focus:bg-background"
            />
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : products.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border bg-card p-3 transition-colors hover:border-primary hover:shadow-sm"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {product.images?.[0]?.src && (
                      <Image
                        src={product.images[0].src}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <h3 className="line-clamp-2 text-sm font-semibold">{product.name}</h3>
                    <p className="mt-1 font-bold text-sale-red">
                      {formatRupiah(parseInt(product.price || "0", 10))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <p>Tidak ada komponen yang ditemukan.</p>
              <p className="text-sm">Coba gunakan kata kunci lain.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
