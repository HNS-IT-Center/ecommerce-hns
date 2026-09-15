"use client"

import Link from "next/link"
import { ArrowRight, Boxes } from "lucide-react"

import type { ProductTypeTotals } from "@/lib/api/admin-dashboard"
import type { RootCategoryOption } from "@/lib/api/woocommerce/categories"
import { loadProductTypeTotals } from "./actions"
import { CategoryFilter } from "./category-filter"
import { OverviewCard, formatCount } from "./overview-card"
import { productListHref } from "./product-links"
import { useCardLoader } from "./use-card-loader"

export function ProductTotalsCard({
  categories,
  initial,
}: {
  categories: RootCategoryOption[]
  initial: ProductTypeTotals
}) {
  const { param: categoryId, data, error, isPending, update } = useCardLoader<number | null, ProductTypeTotals>(
    null,
    initial,
    loadProductTypeTotals
  )

  return (
    <OverviewCard
      id="overview-totals"
      tone="info"
      icon={Boxes}
      title="Total produk"
      description="Terbit & draft, tanpa produk private"
      isPending={isPending}
      error={error}
      actions={
        <CategoryFilter
          categories={categories}
          value={categoryId}
          onChange={update}
          label="Saring total produk per kategori induk"
        />
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Semua produk"
          value={data.simple + data.variable}
          href={productListHref({ categoryId })}
        />
        <StatTile
          label="Produk simple"
          value={data.simple}
          href={productListHref({ type: "simple", categoryId })}
        />
        <StatTile
          label="Produk bervariasi"
          value={data.variable}
          note={`${formatCount(data.variations)} varian`}
          href={productListHref({ type: "variable", categoryId })}
        />
      </div>
    </OverviewCard>
  )
}

function StatTile({
  label,
  value,
  note,
  href,
}: {
  label: string
  value: number
  note?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-1 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {label}
        <ArrowRight className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      <span className="text-3xl font-semibold tabular-nums tracking-tight">{formatCount(value)}</span>
      <span className="min-h-4 text-xs text-muted-foreground">{note}</span>
    </Link>
  )
}
