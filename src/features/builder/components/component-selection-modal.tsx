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

interface AttributeTerm {
  id: number
  name: string
  count: number
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

type CompletedTermsFetch = {
  key: string
  terms: AttributeTerm[]
}

export function ComponentSelectionModal({ isOpen, onClose, slot }: ComponentSelectionModalProps) {
  const [search, setSearch] = useState("")
  // null = "Semua" (pakai slot.categorySlug gabungan), selain itu override ke
  // 1 sub-kategori spesifik (mis. cuma "SSD NVMe").
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [capacityTermId, setCapacityTermId] = useState("")
  const [completed, setCompleted] = useState<CompletedFetch | null>(null)
  const [completedTerms, setCompletedTerms] = useState<CompletedTermsFetch | null>(null)

  const selectItem = useBuilderStore((state) => state.selectItem)

  const effectiveCategorySlug = typeFilter ?? slot.categorySlug

  // Kombinasi kategori+pencarian+filter yang identifies hasil fetch saat ini.
  const fetchKey = `${effectiveCategorySlug}::${search}::${capacityTermId}`

  useEffect(() => {
    if (!isOpen) return

    let isStale = false

    const url = new URL("/api/products", window.location.origin)
    url.searchParams.set("categorySlug", effectiveCategorySlug)
    if (search) {
      url.searchParams.set("search", search)
    }
    if (slot.attributeSlug && capacityTermId) {
      url.searchParams.set("attribute", slot.attributeSlug)
      url.searchParams.set("attributeTerm", capacityTermId)
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
  }, [isOpen, fetchKey, effectiveCategorySlug, search, capacityTermId, slot.attributeSlug])

  // Daftar term kapasitas (mis. "1TB+", "2TB+") buat isi dropdown filter —
  // cuma di-fetch kalau slot ini punya attributeSlug.
  useEffect(() => {
    if (!isOpen || !slot.attributeSlug) return

    let isStale = false
    const attributeSlug = slot.attributeSlug

    const url = new URL("/api/attribute-terms", window.location.origin)
    url.searchParams.set("attributeSlug", attributeSlug)

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (isStale) return
        setCompletedTerms({ key: attributeSlug, terms: Array.isArray(data) ? data : [] })
      })
      .catch((error) => {
        console.error("Failed to fetch attribute terms", error)
        if (isStale) return
        setCompletedTerms({ key: attributeSlug, terms: [] })
      })

    return () => {
      isStale = true
    }
  }, [isOpen, slot.attributeSlug])

  if (!isOpen) return null

  // "loading" adalah nilai turunan: fetch untuk kombinasi kategori+pencarian
  // saat ini belum selesai — bukan setState di badan effect. Pola yang sama
  // dengan use-live-search.ts.
  const loading = !completed || completed.key !== fetchKey
  const products = !loading ? completed.products : []
  const terms = completedTerms && completedTerms.key === slot.attributeSlug ? completedTerms.terms : []

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

        {/* Search + Filter */}
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

          {/* Filter jenis (chip) */}
          {slot.typeFilters && slot.typeFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setTypeFilter(null)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  typeFilter === null
                    ? "border-brand-green bg-brand-green/10 text-brand-green"
                    : "border-input text-muted-foreground hover:border-brand-green/50"
                }`}
              >
                Semua
              </button>
              {slot.typeFilters.map((option) => (
                <button
                  key={option.categorySlug}
                  onClick={() => setTypeFilter(option.categorySlug)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    typeFilter === option.categorySlug
                      ? "border-brand-green bg-brand-green/10 text-brand-green"
                      : "border-input text-muted-foreground hover:border-brand-green/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Filter kapasitas (dropdown) */}
          {slot.attributeSlug && terms.length > 0 && (
            <select
              value={capacityTermId}
              onChange={(e) => setCapacityTermId(e.target.value)}
              className="mt-3 w-full rounded-xl border border-input bg-muted/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
            >
              <option value="">Semua Kapasitas</option>
              {terms.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          )}
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
                        // Wadahnya tetap 80px (h-20 w-20) di semua ukuran layar.
                        sizes="80px"
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
