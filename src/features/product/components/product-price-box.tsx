import { formatRupiah } from "@/lib/utils";
import type { VariationPriceRange } from "@/features/product/lib/calculate-variation-price-range";

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
  /**
   * Terisi hanya untuk produk bervariasi yang varian-nya BELUM dipilih. Saat
   * ada, rentang ini menggantikan harga tunggal — lihat `calculateVariationPriceRange`.
   */
  priceRange?: VariationPriceRange | null;
};

export function ProductPriceBox({
  onSale,
  displaySale,
  discountPercent,
  displayRegular,
  displayPrice,
  priceRange,
}: ProductPriceBoxProps) {
  return (
    /* Di mobile kotaknya melebar sampai tepi layar.

       `-mx-4` membatalkan `px-4` milik panel info (lihat product-detail.tsx),
       jadi blok ini membentang penuh selebar layar seperti di aplikasi
       marketplace — bukan kartu mengambang dengan sudut membulat di tengah
       kolom. Warna latarnya dipertahankan supaya harga tetap terbaca sebagai
       blok tersendiri, dan pemisahnya berpindah dari border melingkar ke garis
       atas-bawah, satu-satunya sisi yang masih terlihat saat lebarnya penuh.

       Desktop kembali jadi kartu utuh: di sana panelnya cuma satu kolom dari
       dua, dan bleed ke tepi kolom justru merusak sejajarnya dengan galeri.

       TINGGINYA DIPATOK (`min-h`), dan itu disengaja. Ketiga cabang di bawah
       tidak sama tinggi: rentang harga membawa baris "Pilih varian untuk
       melihat harga pastinya", harga diskon membawa baris coret, sedangkan
       harga biasa hanya satu baris. Tanpa tinggi minimum, memilih varian
       menggeser tinggi kotak ini dan SELURUH isi halaman di bawahnya ikut
       melompat tepat saat pembeli sedang menekan tombol varian — persis
       lompatan yang membuat jari mendarat di tombol yang salah.

       Angkanya diambil dari cabang tertinggi (harga 2xl + baris kedua + padding),
       jadi tidak ada cabang yang perlu tumbuh melewatinya. `justify-center`
       membuat cabang satu baris duduk di tengah ruang itu, bukan menggantung
       di atas dengan ruang kosong menganga di bawahnya. */
    <div className="-mx-4 flex min-h-[92px] flex-col justify-center border-y border-border bg-muted/30 px-4 py-4 md:mx-0 md:min-h-[108px] md:rounded-xl md:border md:p-5">
      {priceRange ? (
        /**
         * Rentang tampil polos tanpa badge diskon maupun harga coret: tiap
         * varian punya status sale-nya sendiri, jadi satu badge diskon di atas
         * rentang gabungan akan mengklaim potongan yang belum tentu berlaku
         * untuk varian yang akhirnya dipilih pembeli.
         */
        <>
          <span className="text-2xl font-extrabold text-sale-red md:text-3xl">
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
      ) : onSale && displaySale ? (
        <>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold text-sale-red md:text-3xl">
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
        <span className="text-2xl font-extrabold text-sale-red md:text-3xl">
          {formatRupiah(displayPrice)}
        </span>
      )}
    </div>
  );
}
