/**
 * Harga yang ditampilkan ke pelanggan, diturunkan HANYA dari katalog.
 *
 * Berkas ini pernah memuat "harga member": diskon 5% yang dikarang di sini
 * (`baseFinalPrice * 0.95`) dan menyala untuk siapa pun yang "login" — padahal
 * login itu sendiri simulasi localStorage yang menerima email apa saja. Angka
 * hasil karangan itu bukan cuma tampil, ia ikut ke keranjang dan ke pesan
 * WhatsApp checkout, sehingga CS menerima total yang tidak bisa dipenuhi dan
 * harus menolaknya di depan pelanggan yang merasa sudah melihatnya di situs ini.
 *
 * Karena itu tidak ada lagi perkalian, pengurangan, atau simulasi harga di sini.
 * Satu-satunya potongan yang sah adalah `salePrice` dari katalog, yang memang
 * ditetapkan staff lewat panel admin. Lihat CLAUDE.md §2.7.
 */

export type CalculateProductPriceInput = {
  price: string;
  regularPrice: string;
  salePrice: string;
  onSale: boolean;
};

export type CalculateProductPriceResult = {
  displayPrice: number;
  displayRegular: number;
  displaySale: number | null;
  /**
   * Harga yang benar-benar dibayar: harga diskon kalau sedang diskon, kalau
   * tidak harga normal. Inilah satu-satunya angka yang boleh masuk keranjang.
   */
  finalPrice: number;
  discountPercent: number;
};

export function calculateProductPrice({
  price,
  regularPrice,
  salePrice,
  onSale,
}: CalculateProductPriceInput): CalculateProductPriceResult {
  const displayPrice = parseInt(price || "0", 10);
  const displayRegular = parseInt(regularPrice || price || "0", 10);
  const displaySale = salePrice ? parseInt(salePrice, 10) : null;

  const finalPrice = onSale && displaySale ? displaySale : displayPrice;

  // Persentase diskon dihitung dari dua angka katalog, bukan ditetapkan sendiri
  // — ia keterangan atas selisih yang sudah ada, bukan sumber potongannya.
  const discountPercent =
    onSale && displaySale && displayRegular > 0
      ? Math.round(((displayRegular - displaySale) / displayRegular) * 100)
      : 0;

  return {
    displayPrice,
    displayRegular,
    displaySale,
    finalPrice,
    discountPercent,
  };
}
