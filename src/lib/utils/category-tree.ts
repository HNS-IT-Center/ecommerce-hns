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

/** Id seluruh leluhur sebuah kategori, dari induk langsung sampai akar. */
function collectAncestorIds(categoryId: number, categories: ProductCategory[]): number[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ancestors: number[] = [];
  const seen = new Set<number>([categoryId]);
  let parent = byId.get(categoryId)?.parent ?? 0;
  // `seen` menjaga dari data induk yang melingkar — tanpa itu satu baris
  // kategori yang salah tunjuk membuat perulangan ini tidak pernah berhenti.
  while (parent !== 0 && !seen.has(parent)) {
    ancestors.push(parent);
    seen.add(parent);
    parent = byId.get(parent)?.parent ?? 0;
  }
  return ancestors;
}

/**
 * Id kategori untuk penyaring `?category=` di `/shop` dan `/search`.
 *
 * Kategori yang dicentang digabung dengan ATAU, dan induk sudah mencakup
 * seluruh keturunannya. Akibatnya, kalau induk dan anaknya dicentang bersama,
 * anaknya tenggelam: "AKSESSORIES KOMPUTER + CARD READER" dulu menghasilkan
 * 1.028 produk, sama persis dengan induknya saja, padahal yang dimaksud
 * pembeli jelas Card Reader (Oktober 2026).
 *
 * Aturannya: induk yang salah satu keturunannya ikut dicentang DIABAIKAN —
 * pilihan yang lebih spesifik menang. Sidebar sudah tidak menghasilkan URL
 * seperti itu (lihat `toggleCategorySlug`), tapi tautan lama dan URL yang
 * diketik tangan tetap ada.
 *
 * `undefined` = tidak ada slug yang cocok, artinya tidak menyaring kategori.
 */
export function resolveCategoryFilterIds(
  slugs: string[],
  categories: ProductCategory[]
): number[] | undefined {
  const selected = slugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is ProductCategory => c !== undefined);

  const shadowed = new Set<number>();
  for (const cat of selected) {
    for (const ancestorId of collectAncestorIds(cat.id, categories)) shadowed.add(ancestorId);
  }

  const ids = new Set<number>();
  for (const cat of selected) {
    if (shadowed.has(cat.id)) continue;
    for (const id of collectCategoryAndDescendantIds(cat.id, categories)) ids.add(id);
  }
  return ids.size > 0 ? Array.from(ids) : undefined;
}

/**
 * Daftar slug kategori setelah satu kotak dicentang/dilepas di sidebar.
 *
 * Mencentang sebuah kategori melepas leluhur DAN keturunannya yang sedang
 * tercentang: keduanya tumpang-tindih dengan pilihan baru, dan membiarkannya
 * membuat sidebar menampilkan centang yang tidak berpengaruh apa pun pada
 * hasil. Pembeli yang mencentang "CARD READER" di bawah "AKSESSORIES KOMPUTER"
 * yang sudah tercentang sedang mempersempit pilihannya, bukan menambah.
 */
export function toggleCategorySlug(
  selectedSlugs: string[],
  slug: string,
  checked: boolean,
  categories: ProductCategory[]
): string[] {
  if (!checked) return selectedSlugs.filter((s) => s !== slug);

  const target = categories.find((c) => c.slug === slug);
  if (!target) return selectedSlugs.includes(slug) ? selectedSlugs : [...selectedSlugs, slug];

  const overlapping = new Set<number>([
    ...collectAncestorIds(target.id, categories),
    ...collectCategoryAndDescendantIds(target.id, categories),
  ]);
  const kept = selectedSlugs.filter((s) => {
    const cat = categories.find((c) => c.slug === s);
    return !cat || !overlapping.has(cat.id);
  });
  return [...kept, slug];
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
