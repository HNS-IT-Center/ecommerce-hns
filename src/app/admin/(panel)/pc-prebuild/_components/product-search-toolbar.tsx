"use client"

import { useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"

import type { AttributeRequirementGroup } from "@/lib/pc-builder/compatibility"
import type { PrebuildAttributeFacet, PrebuildSortMode } from "@/lib/pc-prebuild/products"

import { prebuildAttributeFacetsAction } from "../actions"
import { AttributeFilterDialog } from "./attribute-filter-dialog"
import type { ProductSearch } from "./use-product-search"

/**
 * Bilah alat grid produk: cari · urutkan · filter atribut.
 *
 * `withAttributeFilter` mati untuk bilah yang hidup DI DALAM sebuah dialog.
 * Dialog di project ini tidak boleh dirantai — `useBackToClose` mendorong satu
 * entri riwayat boneka per dialog, dan yang kedua justru memakan entri milik
 * dirinya sendiri sehingga tertutup pada detik yang sama ia dibuka (catatan
 * lengkapnya di `builder-quick-view-dialog.tsx`). Kata kunci dan pengurutan
 * sudah cukup untuk memilih segelintir pengganti; filter atribut adalah alat
 * untuk menyisir kategori, dan penyisiran dilakukan di grid utama.
 */

const URUTAN: { value: PrebuildSortMode; label: string }[] = [
  { value: "default", label: "Paling sering dilihat" },
  { value: "name_asc", label: "Nama A → Z" },
  { value: "name_desc", label: "Nama Z → A" },
  { value: "price_asc", label: "Harga termurah" },
  { value: "price_desc", label: "Harga termahal" },
]

export function ProductSearchToolbar({
  search,
  stepId,
  stepName,
  categoryIds,
  requiredAttributeValueGroups,
  withAttributeFilter = true,
  compact = false,
}: {
  search: ProductSearch
  stepId: string
  stepName: string
  categoryIds: number[]
  requiredAttributeValueGroups: AttributeRequirementGroup[]
  withAttributeFilter?: boolean
  compact?: boolean
}) {
  const [filterBuka, setFilterBuka] = useState(false)
  const [facets, setFacets] = useState<PrebuildAttributeFacet[] | null>(null)
  const [facetsMemuat, setFacetsMemuat] = useState(false)
  const facetsKunci = useRef<string | null>(null)

  const syaratKunci = requiredAttributeValueGroups.map((g) => g.join(",")).join("|")
  const tinggi = compact ? "h-9" : "h-10"

  /**
   * Daftar atribut dimuat saat modalnya DIBUKA, bukan saat panel dibuka: modal
   * ini tidak selalu dipakai, dan kuerinya menyapu seluruh kandidat kategori.
   * Dimuat ulang kalau syarat kompatibilitasnya berubah — mengganti prosesor
   * mengubah mainboard yang jadi kandidat, dan bersamanya atribut yang masuk
   * akal ditawarkan.
   */
  useEffect(() => {
    if (!filterBuka) return
    const kunci = `${stepId}::${syaratKunci}`
    if (facetsKunci.current === kunci && facets !== null) return

    let batal = false
    setFacetsMemuat(true)
    prebuildAttributeFacetsAction({
      categoryIds,
      requiredAttributeValueGroups: syaratKunci
        ? syaratKunci.split("|").map((g) => g.split(",").map(Number))
        : [],
    })
      .then(({ facets: hasilFacet }) => {
        if (batal) return
        facetsKunci.current = kunci
        setFacets(hasilFacet)
      })
      .finally(() => {
        if (!batal) setFacetsMemuat(false)
      })

    return () => {
      batal = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBuka, stepId, syaratKunci])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search
            className={`absolute left-3 ${compact ? "top-2.5 h-3.5 w-3.5" : "top-3 h-4 w-4"} text-muted-foreground`}
          />
          <input
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            placeholder={`Cari produk untuk ${stepName}…`}
            className={`${tinggi} w-full min-w-0 rounded-xl border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-brand-green`}
          />
        </div>

        <label className="shrink-0">
          <span className="sr-only">Urutkan</span>
          <select
            value={search.sort}
            onChange={(e) => search.setSort(e.target.value as PrebuildSortMode)}
            className={`${tinggi} rounded-xl border bg-card px-2.5 text-xs font-semibold outline-none transition-colors focus:border-brand-green`}
          >
            {URUTAN.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        {withAttributeFilter && (
          <button
            type="button"
            onClick={() => setFilterBuka(true)}
            className={`${tinggi} inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              search.jumlahFilter > 0
                ? "border-brand-green bg-brand-green/10 text-brand-green"
                : "hover:border-brand-green hover:text-brand-green"
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter Atribut
            {search.jumlahFilter > 0 && (
              <span className="rounded-full bg-brand-green px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {search.jumlahFilter}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Chip filter aktif — penyaringan tidak boleh tak kasat mata. */}
      {withAttributeFilter && search.jumlahFilter > 0 && facets && (
        <div className="flex flex-wrap items-center gap-1.5">
          {facets.map((f) =>
            (search.filter[f.attributeId] ?? []).map((valueId) => {
              const nilai = f.values.find((v) => v.valueId === valueId)
              return (
                <span
                  key={`${f.attributeId}-${valueId}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-green/10 py-0.5 pl-2 pr-1 text-xs font-semibold text-brand-green"
                >
                  <span className="min-w-0 truncate">
                    {f.attributeName}: {nilai?.valueName ?? `#${valueId}`}
                  </span>
                  <button
                    type="button"
                    aria-label={`Cabut filter ${f.attributeName} ${nilai?.valueName ?? valueId}`}
                    onClick={() => {
                      const sisa = (search.filter[f.attributeId] ?? []).filter(
                        (id) => id !== valueId
                      )
                      const hasil = { ...search.filter }
                      if (sisa.length === 0) delete hasil[f.attributeId]
                      else hasil[f.attributeId] = sisa
                      search.setFilter(hasil)
                    }}
                    className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-brand-green/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )
            })
          )}
          <button
            type="button"
            onClick={() => search.setFilter({})}
            className="text-xs font-semibold text-muted-foreground transition-colors hover:text-sale-red"
          >
            Hapus semua filter
          </button>
        </div>
      )}

      {withAttributeFilter && (
        <AttributeFilterDialog
          open={filterBuka}
          onOpenChange={setFilterBuka}
          stepName={stepName}
          facets={facets ?? []}
          loading={facetsMemuat && facets === null}
          value={search.filter}
          onApply={search.setFilter}
        />
      )}
    </div>
  )
}
