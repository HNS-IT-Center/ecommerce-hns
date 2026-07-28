import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma/client";
import { prismaCategoryToWoo } from "./db-mapper";
import type { ProductCategory } from "@/types/woocommerce";
import { decodeHtmlEntities } from "@/lib/utils/html";

type GetCategoriesParams = {
  perPage?: number;
  page?: number;
  parent?: number; // 0 for top-level only
  hideEmpty?: boolean;
  search?: string;
  slug?: string;
};

export async function getCategories(
  params: GetCategoriesParams = {}
): Promise<ProductCategory[]> {
  const fetcher = unstable_cache(
    async () => {
      const where: Prisma.CategoryWhereInput = {};

      if (params.parent !== undefined) {
        where.parentId = params.parent === 0 ? null : params.parent;
      }
      if (params.search) {
        where.name = { contains: params.search };
      }
      if (params.slug) {
        where.slug = params.slug;
      }
      // If hideEmpty is true, we should only fetch categories with products.
      if (params.hideEmpty) {
        where.products = { some: {} };
      }

      const categories = await getPrisma().category.findMany({
        where,
        take: params.perPage || 100,
        skip: params.page && params.perPage ? (params.page - 1) * params.perPage : 0,
        include: {
          _count: {
            select: { products: true }
          }
        },
        orderBy: { name: 'asc' },
      });

      return categories.map(prismaCategoryToWoo);
    },
    [JSON.stringify(params), "getCategories"],
    { revalidate: 3600, tags: ["categories"] }
  );

  const categories = await fetcher();

  return categories.map((category) => ({
    ...category,
    name: decodeHtmlEntities(category.name),
    description: decodeHtmlEntities(category.description),
  }));
}

/** Ambil SEMUA kategori (paginated di belakang layar) — dipakai form admin produk. */
export async function getAllCategories(): Promise<ProductCategory[]> {
  const all: ProductCategory[] = [];
  let page = 1;

  while (true) {
    const batch = await getCategories({ perPage: 100, page });
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return all;
}

// --------------------------------------------------------------- admin: tulis

export type AdminCategory = {
  id: number;
  name: string;
  path: string;
  slug: string;
  depth: number;
  parentId: number | null;
  /** Produk yang menempel LANGSUNG di kategori ini. */
  productCount: number;
  childCount: number;
};

/** Kesalahan yang layak ditampilkan apa adanya ke staff, bukan ditelan jadi 500. */
export class CategoryOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryOperationError";
  }
}

/**
 * Daftar lengkap untuk layar manajemen. Sengaja tidak lewat `unstable_cache`:
 * staff harus melihat hasil suntingannya sendiri seketika, dan layar ini hanya
 * dibuka segelintir orang.
 */
export async function getCategoriesForAdmin(): Promise<AdminCategory[]> {
  const rows = await getPrisma().category.findMany({
    orderBy: { path: "asc" },
    include: { _count: { select: { products: true, children: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: decodeHtmlEntities(row.name),
    path: row.path,
    slug: row.slug,
    depth: row.depth,
    parentId: row.parentId,
    productCount: row._count.products,
    childCount: row._count.children,
  }));
}

/** Slug mengikuti path penuh, konvensi yang sudah dipakai seluruh tabel. */
function slugFromPath(path: string): string {
  return path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createCategory(name: string, parentId: number | null): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new CategoryOperationError("Nama kategori tidak boleh kosong.");

  const prisma = getPrisma();
  const parent = parentId === null ? null : await prisma.category.findUnique({ where: { id: parentId } });
  if (parentId !== null && !parent) {
    throw new CategoryOperationError("Kategori induk tidak ditemukan.");
  }

  const path = parent ? `${parent.path} > ${trimmed}` : trimmed;
  const slug = slugFromPath(path);

  // Path dan slug dua-duanya unik di skema; dicek lebih dulu supaya staff dapat
  // kalimat yang bisa ditindaklanjuti, bukan pelanggaran constraint.
  const bentrok = await prisma.category.findFirst({
    where: { OR: [{ path }, { slug }] },
    select: { path: true },
  });
  if (bentrok) {
    throw new CategoryOperationError(`Kategori "${bentrok.path}" sudah ada.`);
  }

  await prisma.category.create({
    data: { name: trimmed, path, slug, depth: parent ? parent.depth + 1 : 1, parentId },
  });
}

/**
 * Ganti nama kategori.
 *
 * `path` menyimpan jalur lengkap, jadi mengganti nama satu simpul mengharuskan
 * path SELURUH keturunannya ditulis ulang — kalau tidak, pohonnya pecah dan
 * kategori anak menunjuk jalur yang tidak ada lagi.
 *
 * Slug sengaja TIDAK diubah supaya URL kategori yang sudah diindeks tidak mati.
 * Akibatnya slug bisa tidak lagi mencerminkan namanya; pembenahan slug
 * menyeluruh punya tugas sendiri.
 */
export async function renameCategory(id: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new CategoryOperationError("Nama kategori tidak boleh kosong.");

  const prisma = getPrisma();
  const target = await prisma.category.findUnique({ where: { id } });
  if (!target) throw new CategoryOperationError("Kategori tidak ditemukan.");
  if (target.name === trimmed) return;

  const cut = target.path.lastIndexOf(" > ");
  const newPath = cut === -1 ? trimmed : `${target.path.slice(0, cut)} > ${trimmed}`;

  const bentrok = await prisma.category.findFirst({
    where: { path: newPath, NOT: { id } },
    select: { id: true },
  });
  if (bentrok) throw new CategoryOperationError(`Kategori "${newPath}" sudah ada.`);

  const descendants = await prisma.category.findMany({
    where: { path: { startsWith: `${target.path} > ` } },
    select: { id: true, path: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { name: trimmed, path: newPath } });
    for (const child of descendants) {
      await tx.category.update({
        where: { id: child.id },
        data: { path: newPath + child.path.slice(target.path.length) },
      });
    }
  });
}

/**
 * Hapus kategori.
 *
 * Dua rem pengaman. Kategori beranak ditolak, karena relasi induk-anak memakai
 * `onDelete: Cascade` sehingga satu klik bisa menghapus seluruh cabang tanpa
 * staff pernah melihat isinya. Kategori yang masih memegang produk juga
 * ditolak kecuali jumlahnya ikut dikirim dari layar konfirmasi — angka itu
 * membuktikan staff sudah diberi tahu berapa produk yang kaitannya akan putus.
 */
export async function deleteCategory(id: number, acknowledgedProductCount: number | null): Promise<void> {
  const prisma = getPrisma();
  const target = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!target) throw new CategoryOperationError("Kategori tidak ditemukan.");

  if (target._count.children > 0) {
    throw new CategoryOperationError(
      `"${target.name}" masih punya ${target._count.children} sub-kategori. Hapus atau pindahkan sub-kategorinya lebih dulu.`
    );
  }

  const productCount = target._count.products;
  if (productCount > 0 && acknowledgedProductCount !== productCount) {
    throw new CategoryOperationError(
      `"${target.name}" masih dipakai ${productCount} produk. Konfirmasi dulu lewat tombol hapus di layar kategori.`
    );
  }

  await prisma.category.delete({ where: { id } });}
