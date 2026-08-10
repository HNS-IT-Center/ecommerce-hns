import { formatRupiah } from "@/lib/utils"
import { Shield } from "lucide-react"
import type { VariationPriceRange } from "@/features/product/lib/calculate-variation-price-range"

type ProductPriceBoxProps = {
  isMember: boolean
  mounted: boolean
  memberPrice: number
  baseFinalPrice: number
  onSale: boolean
  displaySale: number | null
  discountPercent: number
  displayRegular: number
  displayPrice: number
  /**
   * Terisi hanya untuk produk bervariasi yang varian-nya BELUM dipilih. Saat
   * ada, rentang ini menggantikan harga tunggal — lihat `calculateVariationPriceRange`.
   */
  priceRange?: VariationPriceRange | null
}

export function ProductPriceBox({
  isMember,
  mounted,
  memberPrice,
  baseFinalPrice,
  onSale,
  displaySale,
  discountPercent,
  displayRegular,
  displayPrice,
  priceRange,
}: ProductPriceBoxProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      {priceRange ? (
        /**
         * Rentang tampil polos tanpa badge diskon maupun harga coret: tiap
         * varian punya status sale-nya sendiri, jadi satu badge diskon di atas
         * rentang gabungan akan mengklaim potongan yang belum tentu berlaku
         * untuk varian yang akhirnya dipilih pembeli.
         */
        <>
          <span className="text-3xl font-extrabold text-sale-red">
            {priceRange.isSingle
              ? formatRupiah(priceRange.min)
              : `${formatRupiah(priceRange.min)} – ${formatRupiah(priceRange.max)}`}
          </span>
          {!priceRange.isSingle && (
            <div className="mt-1 text-sm text-muted-foreground">
              Pilih varian untuk melihat harga pastinya
            </div>
          )}
        </>
      ) : isMember ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-sale-red">
              {formatRupiah(memberPrice)}
            </span>
            <span className="flex items-center gap-1 rounded-md bg-brand-green/10 px-2 py-0.5 text-sm font-bold text-brand-green">
              <Shield className="h-4 w-4" /> Harga Member
            </span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground line-through">
            {formatRupiah(baseFinalPrice)}
          </div>
        </>
      ) : onSale && displaySale ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-sale-red">
              {formatRupiah(displaySale)}
            </span>
            {discountPercent > 0 && (
              <span className="rounded-md bg-sale-red/10 px-2 py-0.5 text-sm font-bold text-sale-red">
                -{discountPercent}%
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground line-through">
            {formatRupiah(displayRegular)}
          </div>
        </>
      ) : (
        <span className="text-3xl font-extrabold text-sale-red">
          {formatRupiah(displayPrice)}
        </span>
      )}

      {/* Member Price Hint — disembunyikan saat menampilkan rentang, karena
          harga member baru bermakna setelah varian tertentu dipilih. */}
      {!isMember && mounted && !priceRange && (
        <div className="mt-3 text-sm">
          <a href="/register" className="font-semibold text-brand-green hover:underline">
            Daftar member untuk harga khusus
          </a>
        </div>
      )}
    </div>
  )
}
