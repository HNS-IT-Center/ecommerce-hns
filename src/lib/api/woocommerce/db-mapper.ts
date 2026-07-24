import type { Product as WooProduct, ProductCategory as WooCategory, ProductImage, ProductAttribute } from "@/types/woocommerce";

export function prismaProductToWoo(prismaProduct: any): WooProduct {
  // Determine prices
  const regularPrice = prismaProduct.regularPrice ? String(prismaProduct.regularPrice) : "0";
  const salePrice = prismaProduct.salePrice ? String(prismaProduct.salePrice) : "";
  const price = salePrice ? salePrice : regularPrice;
  const onSale = Boolean(salePrice);

  // Map categories
  const categories = prismaProduct.categories
    ? prismaProduct.categories.map((pc: any) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
      }))
    : [];

  // Map brands
  const brands = prismaProduct.brand
    ? [
        {
          id: prismaProduct.brand.id,
          name: prismaProduct.brand.name,
          slug: prismaProduct.brand.slug,
        },
      ]
    : [];

  // Map images
  const images: ProductImage[] = prismaProduct.images
    ? prismaProduct.images.map((img: any) => ({
        id: img.id,
        src: img.url,
        alt: prismaProduct.name,
      }))
    : [];

  // Map attributes (group by attribute ID to match Woo structure)
  const attributesMap = new Map<number, ProductAttribute>();
  if (prismaProduct.attributes) {
    for (const pa of prismaProduct.attributes) {
      if (!pa.attribute || !pa.value) continue;
      
      if (!attributesMap.has(pa.attribute.id)) {
        attributesMap.set(pa.attribute.id, {
          id: pa.attribute.id,
          name: pa.attribute.name,
          slug: pa.attribute.name.toLowerCase().replace(/\s+/g, '-'),
          options: [],
          variation: false, // In complete implementation, we'd check if it's used for variations
        });
      }
      attributesMap.get(pa.attribute.id)!.options.push(pa.value.value);
    }
  }
  const attributes = Array.from(attributesMap.values());

  // Map variations
  const variations = prismaProduct.variations
    ? prismaProduct.variations.map((v: any) => v.wooId)
    : [];

  return {
    id: prismaProduct.wooId,
    name: prismaProduct.name,
    slug: prismaProduct.slug,
    permalink: `https://hnsitcenter.id/product/${prismaProduct.slug}`,
    type: prismaProduct.type.toLowerCase() as "simple" | "variable" | "grouped" | "external",
    status: prismaProduct.status.toLowerCase() as "publish" | "draft" | "pending" | "private",
    description: prismaProduct.description || "",
    short_description: prismaProduct.shortDescription || "",
    sku: prismaProduct.sku || "",
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: onSale,
    date_on_sale_from_gmt: null,
    date_on_sale_to_gmt: null,
    stock_status: prismaProduct.stockStatus ? prismaProduct.stockStatus.toLowerCase() as any : "instock",
    stock_quantity: prismaProduct.stockQty,
    categories,
    brands,
    images,
    attributes,
    variations,
    meta_data: [],
    average_rating: "0",
    rating_count: 0,
    total_sales: prismaProduct.viewCount || 0, // Fallback view count as sales
  };
}

export function prismaCategoryToWoo(prismaCategory: any): WooCategory {
  return {
    id: prismaCategory.id,
    name: prismaCategory.name,
    slug: prismaCategory.slug,
    parent: prismaCategory.parentId || 0,
    description: "",
    display: "default",
    image: null,
    menu_order: 0,
    count: prismaCategory._count?.products || 0,
  };
}
