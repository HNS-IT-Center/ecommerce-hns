import { ProductStatus, ProductType, StockStatus, type Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { collectDescendantIds } from "@/lib/utils/category-move";

/**
 * Definisi "produk yang datanya belum beres" — satu tempat, dua pemakai.
 *
 * Kartu di dashboard admin menghitungnya, dan tombol "Lihat semua" di kartu itu
 * membuka daftar `/admin/produk` yang menyaringnya lagi. Kalau keduanya menyusun
 * kondisinya sendiri-sendiri, angka di kartu dan isi daftar akan berbeda begitu
 * salah satunya diubah — dan staff berhenti memercayai keduanya. Karena itu
 * `buildPrismaWhere` di products.ts dan `lib/api/admin-dashboard.ts` sama-sama
 * membangun kondisinya dari berkas ini.
 */

/**
 * Status yang dianggap "produk berjalan". Private sengaja tidak ikut: di data
 * impor, private adalah produk yang sudah disembunyikan dari toko, dan SKU atau
 * stoknya yang kosong bukan pekerjaan yang perlu dikejar.
 */
export const ACTIVE_PRODUCT_STATUSES: ProductStatus[] = [ProductStatus.PUBLISHED, ProductStatus.DRAFT];

/**
 * SKU kosong. Per 14 Sep 2026 seluruhnya tersimpan sebagai NULL, tapi string
 * kosong ikut dijaring: form yang lupa menormalkan input akan menulis `""`, dan
 * baris seperti itu tetap produk tanpa SKU di mata staff.
 */
export const missingSkuWhere: Prisma.ProductWhereInput = {
  OR: [{ sku: null }, { sku: "" }],
};

/**
 * Stok kosong: ditandai habis, ATAU jumlah stoknya nol.
 *
 * Keduanya dibutuhkan karena mewakili dua kebiasaan berbeda. Staff menandai
 * barang habis lewat status, sementara `stock_qty` baru terisi untuk produk yang
 * stoknya dikelola per unit — jumlahnya bisa jatuh ke nol tanpa ada yang
 * mengubah statusnya.
 */
export const emptyStockWhere: Prisma.ProductWhereInput = {
  OR: [{ stockStatus: StockStatus.OUTOFSTOCK }, { stockQty: { lte: 0 } }],
};

export type ProductFlag = "missing-sku" | "empty-stock";

export function flagWhere(flag: ProductFlag): Prisma.ProductWhereInput {
  return flag === "missing-sku" ? missingSkuWhere : emptyStockWhere;
}

/**
 * Kondisi untuk DAFTAR produk induk (`parentId: null`).
 *
 * Produk simple ditandai oleh barisnya sendiri. Produk bervariasi ditandai oleh
 * VARIANNYA: induk memang lazim tanpa SKU dan tanpa stok sendiri, jadi yang
 * membuat induk masuk daftar adalah minimal satu varian aktif yang bermasalah.
 * Varian private (varian yang dimatikan di WooCommerce) tidak dihitung.
 */
export function parentFlagWhere(flag: ProductFlag): Prisma.ProductWhereInput {
  return {
    OR: [
      { AND: [{ type: ProductType.SIMPLE }, flagWhere(flag)] },
      {
        type: ProductType.VARIABLE,
        variations: {
          some: { AND: [{ status: { in: ACTIVE_PRODUCT_STATUSES } }, flagWhere(flag)] },
        },
      },
    ],
  };
}

export type FlaggedVariationCounts = Record<ProductFlag, number>;

/**
 * Jumlah varian aktif yang bermasalah, dikelompokkan per induk.
 *
 * Dipakai tabel `/admin/produk`: induk bervariasi masuk daftar "SKU kosong"
 * karena variannya, sementara kolom SKU induk itu sendiri memang kosong. Tanpa
 * angka ini staff melihat baris yang tampak sama persis dengan induk lain dan
 * tidak tahu varian mana — atau berapa — yang perlu dibereskan.
 *
 * Kunci peta adalah `wooId` induk, karena itulah id yang dipakai baris tabel.
 * Kondisinya dibangun dari `flagWhere` yang sama dengan penyaring daftar,
 * bukan dihitung ulang di JavaScript, supaya keduanya tidak bisa menyimpang.
 */
export async function countFlaggedVariationsByParent(
  parentWooIds: number[]
): Promise<Map<number, FlaggedVariationCounts>> {
  const counts = new Map<number, FlaggedVariationCounts>();
  if (parentWooIds.length === 0) return counts;

  const flags: ProductFlag[] = ["missing-sku", "empty-stock"];
  const results = await Promise.all(
    flags.map((flag) =>
      getPrisma().product.findMany({
        where: {
          AND: [
            {
              type: ProductType.VARIATION,
              status: { in: ACTIVE_PRODUCT_STATUSES },
              parent: { wooId: { in: parentWooIds } },
            },
            flagWhere(flag),
          ],
        },
        select: { parent: { select: { wooId: true } } },
      })
    )
  );

  flags.forEach((flag, index) => {
    for (const row of results[index]) {
      if (!row.parent) continue;
      const entry = counts.get(row.parent.wooId) ?? { "missing-sku": 0, "empty-stock": 0 };
      entry[flag] += 1;
      counts.set(row.parent.wooId, entry);
    }
  });

  return counts;
}

/**
 * Menerjemahkan satu kategori induk menjadi dirinya plus seluruh keturunannya.
 *
 * Produk hampir selalu ditempel ke kategori terdalam ("MOTHERBOARD INTEL"),
 * bukan ke induk teratasnya, jadi menyaring dengan id induk saja akan
 * mengembalikan daftar kosong.
 *
 * Id yang tidak ada di tabel menghasilkan daftar kosong — dan kondisi
 * `in: []` tidak cocok dengan apa pun — alih-alih diam-diam jatuh ke "semua
 * kategori". Angka nol lebih jujur daripada angka yang tampak benar.
 */
export async function resolveCategoryScope(rootId: number): Promise<number[]> {
  const categories = await getPrisma().category.findMany({
    select: { id: true, name: true, path: true, depth: true, parentId: true },
  });
  if (!categories.some((category) => category.id === rootId)) return [];

  return [rootId, ...collectDescendantIds(categories, rootId)];
}
