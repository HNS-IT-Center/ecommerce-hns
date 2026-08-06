import { formatRupiah } from "@/lib/utils";

/**
 * Harga produk. Menampilkan apa yang ada di katalog, tidak menghitung apa pun.
 *
 * Pernah ada cabang "Harga Member" di sini beserta tautan "Daftar member untuk
 * harga khusus" — keduanya dihapus. Diskonnya dikarang di sisi klien dan
 * menjanjikan sesuatu yang tidak pernah ada di katalog. Lihat CLAUDE.md §2.7.
 */
type ProductPriceBoxProps = {
  onSale: boolean;
  displaySale: number | null;
  discountPercent: number;
  displayRegular: number;
  displayPrice: number;
};

export function ProductPriceBox({
  onSale,
  displaySale,
  discountPercent,
  displayRegular,
  displayPrice,
}: ProductPriceBoxProps) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-5">
      {onSale && displaySale ? (
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
        <span className="text-3xl font-extrabold text-foreground">
          {formatRupiah(displayPrice)}
        </span>
      )}
    </div>
  );
}
