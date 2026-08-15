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
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger className="w-full sm:w-[240px] bg-background">
        <SelectValue placeholder="Urutkan" />
      </SelectTrigger>
      <SelectContent side="bottom" align="start" sideOffset={4} alignItemWithTrigger={false}>
        <SelectItem value="default">Default</SelectItem>
        <SelectItem value="title-asc">A - Z</SelectItem>
        <SelectItem value="title-desc">Z - A</SelectItem>
        <SelectItem value="price-desc">Harga Tertinggi ke Terendah</SelectItem>
        <SelectItem value="price-asc">Harga Terendah ke Tertinggi</SelectItem>
        <SelectItem value="date-desc">Produk Terbaru</SelectItem>
        <SelectItem value="popularity-desc">Produk Terpopuler</SelectItem>
      </SelectContent>
    </Select>
  )
}
