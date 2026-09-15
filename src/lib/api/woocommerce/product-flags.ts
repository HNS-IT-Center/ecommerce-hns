/**
 * Nama-nama flag "produk yang datanya belum beres", tanpa kondisi Prisma-nya.
 *
 * Dipisah dari `product-health.ts` karena Client Component (kartu dashboard)
 * butuh nilai-nilai ini saat runtime, sedangkan `product-health.ts` mengimpor
 * Prisma. Berkas ini sengaja tidak mengimpor apa pun supaya aman dibundel ke
 * peramban. Kondisi query-nya tetap tinggal di `product-health.ts`.
 */

export const PRODUCT_FLAGS = ["missing-sku", "empty-stock", "missing-image"] as const;

export type ProductFlag = (typeof PRODUCT_FLAGS)[number];

export function isProductFlag(value: unknown): value is ProductFlag {
  return typeof value === "string" && (PRODUCT_FLAGS as readonly string[]).includes(value);
}

/**
 * Apakah baris INDUK bervariasi ikut diperiksa untuk flag ini.
 *
 * SKU dan stok induk memang lazim kosong — nilainya milik varian. Foto lain
 * soal: foto induk itulah yang tampil di kartu produk storefront, jadi induk
 * tanpa foto adalah masalah tersendiri, terlepas dari foto variannya.
 */
export function flagAppliesToParent(flag: ProductFlag): boolean {
  return flag === "missing-image";
}
