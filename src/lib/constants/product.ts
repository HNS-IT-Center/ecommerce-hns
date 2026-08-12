export const HOT_PRODUCT_THRESHOLD = 10;
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Umur maksimum (hari) sebuah produk masih dianggap "New".
 *
 * Ambang usia, BUKAN "10 produk terbaru": badge ditentukan per-produk oleh
 * `getProductBadge`, yang hanya menerima satu produk dan tidak tahu apa-apa
 * soal katalog global. Menghitung "N terbaru" butuh query terpisah yang
 * hasilnya harus ikut ke setiap jalur render (server action, infinite scroll,
 * related products) — jauh lebih mahal daripada nilainya.
 *
 * Konsekuensinya jumlah produk ber-badge "New" tidak tetap: ikut ritme
 * masuknya barang baru, bisa nol saat sepi dan puluhan setelah restock besar.
 */
export const NEW_PRODUCT_MAX_AGE_DAYS = 15;
