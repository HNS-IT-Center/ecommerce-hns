import type { ProductCategory } from "@/types/woocommerce";

export type CategoryTreeChild = {
  id: number;
  title: string;
  href: string;
};

export type CategoryTreeNode = {
  id: number;
  title: string;
  href: string;
  description: string;
  children: CategoryTreeChild[];
};

/**
 * Collects a category's id plus all descendant ids (recursive), so a parent
 * category page can include products assigned to its child categories.
 */
export function collectCategoryAndDescendantIds(
  categoryId: number,
  categories: ProductCategory[]
): number[] {
  const children = categories.filter((c) => c.parent === categoryId);
  return [
    categoryId,
    ...children.flatMap((child) => collectCategoryAndDescendantIds(child.id, categories)),
  ];
}

/**
 * Memekarkan daftar slug kategori menjadi slug itu sendiri PLUS slug seluruh
 * keturunannya.
 *
 * Dipakai daftar yang dikurasi lewat kode (mis. tab di halaman Home), yang
 * ditulis dengan slug kategori INDUK. Tanpa pemekaran ini, penyaringan produk
 * jatuh ke pencocokan slug persis, dan produk yang hanya ditempel ke
 * sub-kategori — "KABEL HDMI" tanpa "KABEL / CONVERTER" — tidak pernah ikut
 * terbawa. Padanan id-nya adalah `collectCategoryAndDescendantIds`, yang
 * dipakai `/shop`; di sini yang dikembalikan slug supaya daftar kuratornya
 * tetap terbaca manusia dan tipe `excludeCategory` tidak perlu berubah.
 *
 * Slug yang tidak cocok dengan kategori manapun dikembalikan dalam
 * `unmatched`, bukan dibuang diam-diam: slug salah ketik pernah membuat satu
 * tab kosong dan satu tab lain kebobolan tanpa satu pun pesan galat.
 */
export function expandCategorySlugs(
  slugs: string[],
  categories: ProductCategory[]
): { slugs: string[]; unmatched: string[] } {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const expanded = new Set<string>();
  const unmatched: string[] = [];

  for (const slug of slugs) {
    const matched = categories.find((c) => c.slug === slug);
    if (!matched) {
      unmatched.push(slug);
      continue;
    }
    for (const id of collectCategoryAndDescendantIds(matched.id, categories)) {
      const found = byId.get(id);
      if (found) expanded.add(found.slug);
    }
  }

  return { slugs: Array.from(expanded), unmatched };
}

export function buildCategoryTree(categories: ProductCategory[]): CategoryTreeNode[] {
  const rootCategories = categories.filter((c) => c.parent === 0);

  return rootCategories.map((rootCat) => {
    const children = categories.filter((c) => c.parent === rootCat.id);
    return {
      id: rootCat.id,
      title: rootCat.name,
      href: `/shop?category=${rootCat.slug}`,
      description: rootCat.description || "Temukan produk terbaik di kategori ini.",
      children: children.map((child) => ({
        id: child.id,
        title: child.name,
        href: `/shop?category=${child.slug}`,
      })),
    };
  });
}
