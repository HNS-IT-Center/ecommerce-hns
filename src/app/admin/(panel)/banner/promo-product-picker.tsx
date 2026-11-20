"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, Check, Loader2, Package, Plus, Search, X } from "lucide-react"

// Hanya TIPE — lihat catatan di `banner-list.tsx`.
import type { PromoPickerProduct } from "@/lib/api/promos"
import { formatRupiah } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchProductsForPromo } from "./promo-actions"

type PromoProductPickerProps = {
  value: PromoPickerProduct[]
  onChange: (next: PromoPickerProduct[]) => void
}

/**
 * Pemilih produk untuk satu promo: cari → tambah → susun.
 *
 * Harga yang tampil di sini hanya KETERANGAN dari katalog; promo tidak
 * menyimpan harga apa pun (CLAUDE.md §2.7). Lencana "Belum diskon" mengingatkan
 * staff bahwa produknya akan tampil dengan harga normal sampai harga obralnya
 * diatur di halaman produk.
 */
export function PromoProductPicker({ value, onChange }: PromoProductPickerProps) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<PromoPickerProduct[]>([])
  const [searching, setSearching] = React.useState(false)
  const [searchedFor, setSearchedFor] = React.useState("")

  const selectedIds = React.useMemo(() => new Set(value.map((p) => p.id)), [value])

  React.useEffect(() => {
    const keyword = query.trim()
    if (!keyword) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const found = await searchProductsForPromo(keyword)
        if (!cancelled) {
          setResults(found)
          setSearchedFor(keyword)
        }
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const showResults = query.trim() !== "" && searchedFor !== ""

  function add(product: PromoPickerProduct) {
    if (selectedIds.has(product.id)) return
    onChange([...value, product])
  }

  function remove(id: number) {
    onChange(value.filter((p) => p.id !== id))
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const notOnSale = value.filter((p) => p.published && !p.onSaleNow).length

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, SKU, merek, atau kategori…"
          className="pl-8 text-xs md:text-xs"
          aria-label="Cari produk untuk ditambahkan"
        />
        {searching && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && (
        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Tidak ada produk yang cocok dengan “{searchedFor}”.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((product) => {
                const added = selectedIds.has(product.id)
                return (
                  <li key={product.id} className="flex items-center gap-3 px-3 py-2">
                    <ProductSummary product={product} />
                    <Button
                      type="button"
                      size="sm"
                      variant={added ? "outline" : "default"}
                      disabled={added}
                      onClick={() => add(product)}
                      className="shrink-0"
                    >
                      {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {added ? "Sudah" : "Tambah"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold">
            Produk terpilih <span className="tabular-nums text-muted-foreground">({value.length})</span>
          </p>
          {notOnSale > 0 && (
            <p className="text-[11px] text-warning">
              {notOnSale} produk belum punya harga obral di katalog — tampil dengan harga normal.
            </p>
          )}
        </div>

        {value.length === 0 ? (
          <p className="rounded-xl border border-dashed border-input px-4 py-8 text-center text-xs text-muted-foreground">
            Belum ada produk. Cari lalu tekan <strong>Tambah</strong>.
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {value.map((product, index) => (
              <li key={product.id} className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <ProductSummary product={product} />
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Naikkan ${product.name}`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label={`Turunkan ${product.name}`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(product.id)}
                    aria-label={`Keluarkan ${product.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Urutan ini dipakai saat pengunjung belum memilih urutan lain. Produk yang ditarik dari
          katalog (draft/dihapus) otomatis tidak tampil di halaman promo.
        </p>
      </div>
    </div>
  )
}

function ProductSummary({ product }: { product: PromoPickerProduct }) {
  const price = product.onSaleNow ? product.salePrice : product.regularPrice

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- thumbnail kecil dari URL R2 dinamis
          <img src={product.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-medium">{product.name}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {product.sku && <span className="font-mono">{product.sku}</span>}
          {price !== null && (
            <span className={cn("tabular-nums", product.onSaleNow && "font-semibold text-sale-red")}>
              {formatRupiah(price)}
            </span>
          )}
          {product.onSaleNow && product.regularPrice !== null && (
            <span className="tabular-nums line-through">{formatRupiah(product.regularPrice)}</span>
          )}
          {!product.published ? (
            <span className="rounded bg-muted px-1 py-px text-[10px] font-semibold">Tidak terbit</span>
          ) : (
            !product.onSaleNow && (
              <span className="rounded bg-warning/10 px-1 py-px text-[10px] font-semibold text-warning">
                Belum diskon
              </span>
            )
          )}
        </div>
      </div>
    </div>
  )
}
