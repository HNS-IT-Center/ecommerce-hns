"use client"

import { useState } from "react"
import { PackageX, ScanBarcode } from "lucide-react"

import type { DashboardProductItem, ProductFlagSummary } from "@/lib/api/admin-dashboard"
import type { RootCategoryOption } from "@/lib/api/woocommerce/categories"
import type { ProductFlag } from "@/lib/api/woocommerce/product-health"
import { cn } from "@/lib/utils"
import { loadProductFlagSummary } from "./actions"
import { CategoryFilter } from "./category-filter"
import {
  OverviewCard,
  OverviewEmpty,
  OverviewFooterLink,
  OverviewList,
  OverviewRow,
  Pill,
  formatCount,
} from "./overview-card"
import { productEditHref, productListHref } from "./product-links"
import { useCardLoader } from "./use-card-loader"

type Segment = "simple" | "variation"

const COPY: Record<
  ProductFlag,
  { title: string; description: string; emptySimple: string; emptyVariation: string }
> = {
  "missing-sku": {
    title: "Produk tanpa SKU",
    description: "Lengkapi SKU supaya produk bisa dicari & dipindai",
    emptySimple: "Semua produk simple sudah punya SKU.",
    emptyVariation: "Semua varian sudah punya SKU.",
  },
  "empty-stock": {
    title: "Stok kosong",
    description: "Ditandai habis atau jumlah stoknya 0",
    emptySimple: "Tidak ada produk simple yang stoknya kosong.",
    emptyVariation: "Tidak ada varian yang stoknya kosong.",
  },
}

/**
 * Satu kartu untuk dua masalah — SKU kosong dan stok kosong. Bentuknya sama
 * persis (dua kelompok, daftar, tautan ke daftar produk), jadi bedanya cukup
 * teks dan lencana di tiap baris.
 *
 * Varian ditampilkan sebagai kelompok sendiri karena penanganannya berbeda:
 * varian disunting dari form induknya, dan "Lihat semua" untuk varian membuka
 * daftar INDUK yang punya varian bermasalah — daftar produk admin tidak
 * menampilkan baris varian.
 */
export function ProductFlagCard({
  flag,
  categories,
  initial,
}: {
  flag: ProductFlag
  categories: RootCategoryOption[]
  initial: ProductFlagSummary
}) {
  const [segment, setSegment] = useState<Segment>("simple")
  const { param: categoryId, data, error, isPending, update } = useCardLoader<number | null, ProductFlagSummary>(
    null,
    initial,
    (next) => loadProductFlagSummary(flag, next)
  )

  const copy = COPY[flag]
  const group = segment === "simple" ? data.simple : data.variation
  const remaining = group.count - group.items.length

  return (
    <OverviewCard
      id={`overview-${flag}`}
      tone={flag === "missing-sku" ? "danger" : "warning"}
      icon={flag === "missing-sku" ? ScanBarcode : PackageX}
      title={copy.title}
      description={copy.description}
      isPending={isPending}
      error={error}
      actions={
        <CategoryFilter
          categories={categories}
          value={categoryId}
          onChange={update}
          label={`Saring ${copy.title.toLowerCase()} per kategori induk`}
        />
      }
    >
      <div role="tablist" aria-label="Jenis produk" className="mb-2 flex w-full rounded-lg bg-muted p-0.5 sm:w-fit">
        <SegmentButton active={segment === "simple"} onClick={() => setSegment("simple")}>
          Produk simple <span className="tabular-nums text-muted-foreground">{formatCount(data.simple.count)}</span>
        </SegmentButton>
        <SegmentButton active={segment === "variation"} onClick={() => setSegment("variation")}>
          Varian <span className="tabular-nums text-muted-foreground">{formatCount(data.variation.count)}</span>
        </SegmentButton>
      </div>

      {group.items.length === 0 ? (
        <OverviewEmpty>{segment === "simple" ? copy.emptySimple : copy.emptyVariation}</OverviewEmpty>
      ) : (
        <OverviewList label={`${copy.title} — ${segment === "simple" ? "produk simple" : "varian"}`}>
          {group.items.map((item) => (
            <OverviewRow
              key={item.id}
              href={productEditHref(item.editId)}
              title={item.name}
              subtitle={item.category ?? "Tanpa kategori"}
              trailing={<RowBadges flag={flag} item={item} />}
            />
          ))}
        </OverviewList>
      )}

      {segment === "simple" && group.count > 0 && (
        <OverviewFooterLink href={productListHref({ type: "simple", flag, categoryId })}>
          {remaining > 0 ? `Lihat ${formatCount(remaining)} produk lainnya` : "Buka di daftar produk"}
        </OverviewFooterLink>
      )}
      {segment === "variation" && data.variation.parentCount > 0 && (
        <OverviewFooterLink href={productListHref({ type: "variable", flag, categoryId })}>
          Lihat {formatCount(data.variation.parentCount)} produk induknya
        </OverviewFooterLink>
      )}
    </OverviewCard>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

function RowBadges({ flag, item }: { flag: ProductFlag; item: DashboardProductItem }) {
  return (
    <>
      {item.status === "DRAFT" && <Pill tone="muted">Draft</Pill>}
      {flag === "empty-stock" && item.isOutOfStock && <Pill tone="danger">Habis</Pill>}
      {flag === "empty-stock" && item.isZeroQty && <Pill tone="warning">Qty 0</Pill>}
    </>
  )
}
