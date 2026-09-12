import { unstable_cache } from "next/cache";
import { getPrisma } from "@/lib/prisma/client";
import { buildPrismaWhere } from "./products";
import type { GetProductsParams } from "@/types/woocommerce";

export type Brand = {
  id: number;
  name: string;
  slug: string;
};

export async function getBrands(): Promise<Brand[]> {
  const fetcher = unstable_cache(
    async () => {
      const brands = await getPrisma().brand.findMany({
        orderBy: { name: 'asc' },
      });
      return brands;
    },
    ["shop-brands"],
    { revalidate: 3600, tags: ["shop-brands"] }
  );

  return fetcher();
}

/**
 * Filter yang boleh mempersempit daftar merek. Sengaja bukan
 * `GetProductsParams` utuh: paginasi dan urutan tidak ada urusannya dengan
 * merek mana yang tersedia, dan kalau ikut masuk ke kunci cache, setiap
 * pindah halaman akan membuat entri cache baru untuk daftar yang isinya sama.
 */
export type AvailableBrandsParams = Pick<
  GetProductsParams,
  "category" | "search" | "minPrice" | "maxPrice" | "onSale" | "brand"
>;

/**
 * Merek yang benar-benar terpakai oleh produk yang lolos filter yang sedang
 * aktif — inilah yang ditampilkan di kotak "Merek" pada sidebar toko.
 *
 * Ini murni soal ISI DAFTAR OPSI, bukan hasil pencarian: query produknya tidak
 * disentuh, jadi produk tanpa merek (`brandId` null) tetap tampil di grid
 * seperti biasa. Ia hanya tidak punya opsi untuk dicentang di sini, karena
 * memang tidak ada nama merek yang bisa dicentang.
 *
 * Dua keputusan yang mudah keliru kalau berkas ini disunting nanti:
 *
 * 1. **Filter merek dikeluarkan dari where-nya.** Kalau ikut, mencentang "Asus"
 *    akan menghapus semua merek lain dari daftar dan multi-pilih jadi mustahil.
 * 2. **Merek yang sedang tercentang selalu ikut ditampilkan**, walau kombinasi
 *    filternya menghasilkan nol produk. Tanpa ini, "Asus + harga di bawah 1 juta"
 *    membuat checkbox Asus lenyap dan pembeli terjebak: filternya masih aktif
 *    tapi tidak ada lagi yang bisa dilepas.
 */
export async function getAvailableBrands(
  params: AvailableBrandsParams = {}
): Promise<Brand[]> {
  const { brand, ...productFilters } = params;
  const selectedSlugs = brand ? (Array.isArray(brand) ? brand : [brand]) : [];

  const fetcher = unstable_cache(
    async () => {
      const grouped = await getPrisma().product.groupBy({
        by: ["brandId"],
        where: { ...buildPrismaWhere(productFilters), brandId: { not: null } },
      });

      const usedIds = grouped
        .map((row) => row.brandId)
        .filter((id): id is number => id !== null);

      if (usedIds.length === 0 && selectedSlugs.length === 0) return [];

      return getPrisma().brand.findMany({
        where:
          selectedSlugs.length > 0
            ? { OR: [{ id: { in: usedIds } }, { slug: { in: selectedSlugs } }] }
            : { id: { in: usedIds } },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      });
    },
    [JSON.stringify(params), "available-brands"],
    // Tag `products` supaya daftarnya ikut disegarkan saat produk berubah merek,
    // `shop-brands` supaya ikut saat mereknya sendiri diubah di admin panel.
    { revalidate: 300, tags: ["products", "shop-brands"] }
  );

  return fetcher();
}
