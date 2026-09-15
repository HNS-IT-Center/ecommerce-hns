"use client"

import { useState } from "react"
import { ImageOff, PackageX, ScanBarcode, type LucideIcon } from "lucide-react"

import type { DashboardProductItem, ProductFlagSummary } from "@/lib/api/admin-dashboard"
import type { RootCategoryOption } from "@/lib/api/woocommerce/categories"
import { flagAppliesToParent, type ProductFlag } from "@/lib/api/woocommerce/product-flags"
import { cn } from "@/lib/utils"
import { loadProductFlagSummary } from "./actions"
import { CategoryFilter } from "./category-filter"
import {
  OverviewCard,
  type OverviewTone,
  OverviewEmpty,
  OverviewFooterLink,
  OverviewList,
  OverviewRow,
  Pill,
  formatCount,
} from "./overview-card"
import { productEditHref, productListHref } from "./product-links"
import { useCardLoader } from "./use-card-loader"

type Segment = "products" | "variation"

const COPY: Record<
  ProductFlag,
  {
    title: string
    description: string
    tone: OverviewTone
    icon: LucideIcon
    productsLabel: string
    emptyProducts: string
    emptyVariation: string
  }
> = {
  "missing-sku": {
    title: "Produk tanpa SKU",
    description: "Lengkapi SKU supaya produk bisa dicari & dipindai",
    tone: "danger",
    icon: ScanBarcode,
    productsLabel: "Produk simple",
    emptyProducts: "Semua produk simple sudah punya SKU.",
    emptyVariation: "Semua varian sudah punya SKU.",
  },
  "empty-stock": {
    title: "Stok kosong",
    description: "Ditandai habis atau jumlah stoknya 0",
    tone: "warning",
    icon: PackageX,
    productsLabel: "Produk simple",
    emptyProducts: "Tidak ada produk simple yang stoknya kosong.",
    emptyVariation: "Tidak ada varian yang stoknya kosong.",
  },
  "missing-image": {
    title: "Belum ada foto utama",
    description: "Produk & varian yang tampil tanpa foto di toko",
    tone: "info",
    icon: ImageOff,
    // Induk bervariasi ikut di kelompok ini — fotonya yang tampil di kartu toko.
    productsLabel: "Produk",
    emptyProducts: "Semua produk sudah punya foto utama.",
    emptyVariation: "Semua varian sudah punya foto utama.",
  },
}

/**
 * Satu kartu untuk tiga masalah — SKU, stok, dan foto utama kosong. Bentuknya
 * sama persis (dua kelompok, daftar, tautan ke daftar produk), jadi bedanya
 * cukup teks dan lencana di tiap baris.
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
  className,
}: {
  flag: ProductFlag
  categories: RootCategoryOption[]
  initial: ProductFlagSummary
  className?: string
}) {
  const [segment, setSegment] = useState<Segment>("products")
  const { param: categoryId, data, error, isPending, update } = useCardLoader<number | null, ProductFlagSummary>(
    null,
    initial,
    (next) => loadProductFlagSummary(flag, next)
  )

  const copy = COPY[flag]
  const group = segment === "products" ? data.products : data.variation
  const remaining = group.count - group.items.length
  /**
   * Untuk flag yang ikut memeriksa induk, daftar produk memuat induk yang
   * bermasalah karena dirinya sendiri MAUPUN karena variannya — jadi tidak ada
   * satu angka yang cocok dengan isi daftar itu. Tautannya dibiarkan tanpa
   * angka, alih-alih menjanjikan jumlah yang tidak akan ditemui staff.
   */
  const checksParent = flagAppliesToParent(flag)

  return (
    <OverviewCard
      id={`overview-${flag}`}
      tone={copy.tone}
      icon={copy.icon}
      className={className}
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
        <SegmentButton active={segment === "products"} onClick={() => setSegment("products")}>
          {copy.productsLabel}{" "}
          <span className="tabular-nums text-muted-foreground">{formatCount(data.products.count)}</span>
        </SegmentButton>
        <SegmentButton active={segment === "variation"} onClick={() => setSegment("variation")}>
          Varian <span className="tabular-nums text-muted-foreground">{formatCount(data.variation.count)}</span>
        </SegmentButton>
      </div>

      {group.items.length === 0 ? (
        <OverviewEmpty>{segment === "products" ? copy.emptyProducts : copy.emptyVariation}</OverviewEmpty>
      ) : (
        <OverviewList
          label={`${copy.title} — ${segment === "products" ? copy.productsLabel.toLowerCase() : "varian"}`}
        >
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

      {segment === "products" && group.count > 0 && (
        <OverviewFooterLink href={productListHref({ type: checksParent ? undefined : "simple", flag, categoryId })}>
          {remaining > 0 && !checksParent
            ? `Lihat ${formatCount(remaining)} produk lainnya`
            : "Buka di daftar produk"}
        </OverviewFooterLink>
      )}
      {segment === "variation" && data.variation.parentCount > 0 && (
        <OverviewFooterLink href={productListHref({ type: "variable", flag, categoryId })}>
          {checksParent
            ? "Buka produk induknya di daftar produk"
            : `Lihat ${formatCount(data.variation.parentCount)} produk induknya`}
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
      {flag === "missing-image" && item.type === "VARIABLE" && <Pill tone="info">Bervariasi</Pill>}
      {flag === "empty-stock" && item.isOutOfStock && <Pill tone="danger">Habis</Pill>}
      {flag === "empty-stock" && item.isZeroQty && <Pill tone="warning">Qty 0</Pill>}
    </>
  )
}
