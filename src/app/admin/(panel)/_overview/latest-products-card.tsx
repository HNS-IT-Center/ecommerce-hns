import { Sparkles } from "lucide-react"

import type { LatestProductItem } from "@/lib/api/admin-dashboard"
import {
  OverviewCard,
  OverviewEmpty,
  OverviewFooterLink,
  OverviewList,
  OverviewRow,
  Pill,
} from "./overview-card"
import { productEditHref } from "./product-links"
import { formatDashboardDate } from "./format-date"

export function LatestProductsCard({ products }: { products: LatestProductItem[] }) {
  return (
    <OverviewCard
      id="overview-latest"
      tone="neutral"
      icon={Sparkles}
      title="Produk terbaru"
      description="10 produk terakhir yang masuk ke katalog"
    >
      {products.length === 0 ? (
        <OverviewEmpty>Belum ada produk.</OverviewEmpty>
      ) : (
        <OverviewList label="Produk terbaru">
          {products.map((product) => (
            <OverviewRow
              key={product.id}
              href={productEditHref(product.editId)}
              title={product.name}
              subtitle={
                <>
                  {formatDashboardDate(product.importedAt)}
                  {product.category && ` · ${product.category}`}
                </>
              }
              trailing={
                <>
                  {product.status === "DRAFT" && <Pill tone="muted">Draft</Pill>}
                  {product.type === "VARIABLE" ? (
                    <Pill tone="info">{product.variationCount} varian</Pill>
                  ) : (
                    <Pill tone="neutral">Simple</Pill>
                  )}
                </>
              }
            />
          ))}
        </OverviewList>
      )}

      <OverviewFooterLink href="/admin/produk?sort=date&order=desc">Lihat semua produk</OverviewFooterLink>
    </OverviewCard>
  )
}
