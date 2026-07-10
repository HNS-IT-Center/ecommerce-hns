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
