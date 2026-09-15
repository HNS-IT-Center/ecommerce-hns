"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ShopSortProps {
  /** Route tujuan saat urutan berubah. Default `/shop`. */
  basePath?: string
}

/**
 * Satu-satunya daftar pilihan urutan — dipakai untuk isi dropdown DAN label
 * yang tampil di tombol setelah dipilih.
 *
 * Wajib diteruskan ke prop `items` milik `<Select>`. Select di sini dari Base
 * UI, yang tidak mengetahui label sebuah pilihan sebelum daftarnya dibuka;
 * tanpa `items`, tombolnya menampilkan nilai mentah — `price-asc` alih-alih
 * "Harga Terendah ke Tertinggi", `default` alih-alih "Default".
 */
const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "title-asc", label: "A - Z" },
  { value: "title-desc", label: "Z - A" },
  { value: "price-desc", label: "Harga Tertinggi ke Terendah" },
  { value: "price-asc", label: "Harga Terendah ke Tertinggi" },
  { value: "date-desc", label: "Produk Terbaru" },
  { value: "popularity-desc", label: "Produk Terpopuler" },
] as const

export function ShopSort({ basePath = "/shop" }: ShopSortProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentOrderBy = searchParams.get("orderby") || "default"
  const currentOrder = searchParams.get("order") || "desc"

  const value = currentOrderBy === "default" ? "default" : `${currentOrderBy}-${currentOrder}`

  const handleValueChange = (val: string | null) => {
    if (!val) return;
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    
    if (val === "default") {
      params.delete("orderby")
      params.delete("order")
    } else {
      const [orderby, order] = val.split("-")
      params.set("orderby", orderby)
      params.set("order", order)
    }
    
    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  return (
    <Select items={SORT_OPTIONS} value={value} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full sm:w-[240px] bg-background">
        <SelectValue placeholder="Urutkan" />
      </SelectTrigger>
      <SelectContent side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
