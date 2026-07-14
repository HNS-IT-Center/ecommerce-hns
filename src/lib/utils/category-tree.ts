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

export function buildCategoryTree(categories: ProductCategory[]): CategoryTreeNode[] {
  const rootCategories = categories.filter((c) => c.parent === 0);

  return rootCategories.map((rootCat) => {
    const children = categories.filter((c) => c.parent === rootCat.id);
    return {
      id: rootCat.id,
      title: rootCat.name,
      href: `/category/${rootCat.slug}`,
      description: rootCat.description || "Temukan produk terbaik di kategori ini.",
      children: children.map((child) => ({
        id: child.id,
        title: child.name,
        href: `/category/${child.slug}`,
      })),
    };
  });
}
