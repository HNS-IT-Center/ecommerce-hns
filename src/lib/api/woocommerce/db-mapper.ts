import type { Product as WooProduct, ProductCategory as WooCategory, ProductImage, ProductAttribute } from "@/types/woocommerce";

/**
 * Enum Prisma -> nilai status ala WooCommerce.
 *
 * Dulu ini `status.toLowerCase()`, dan itu diam-diam salah: PUBLISHED menjadi
 * "published", sedangkan seluruh kode membandingkannya dengan "publish".
 * Cast `as` membuat typechecker ikut diam. Akibatnya setiap pemeriksaan
 * `status === "publish"` selalu gagal — form admin memuat produk terbit dengan
 * status "draft", lalu menyimpannya benar-benar menurunkannya jadi draft.
 * Pemetaan eksplisit menutup celah itu sekaligus membuat perbedaan penamaan
 * kedua sistem terlihat.
 */
const STATUS_TO_WOO = {
  PUBLISHED: "publish",
  DRAFT: "draft",
  PRIVATE: "private",
} as const satisfies Record<string, WooProduct["status"]>;

const STOCK_STATUS_TO_WOO = {
  INSTOCK: "instock",
  OUTOFSTOCK: "outofstock",
  ONBACKORDER: "onbackorder",
} as const satisfies Record<string, WooProduct["stock_status"]>;

export function prismaProductToWoo(prismaProduct: any): WooProduct {
  // Produk VARIABLE (induk) tidak punya harga sendiri di database - harga
  // nempel di tiap VARIATION (child). Tampilkan "mulai dari" harga variasi
  // termurah, bukan field harga induk yang memang kosong (lihat diskusi
  // 2026-07-25 soal parent/child pricing).
  const variationPrices =
    prismaProduct.type === "VARIABLE" && prismaProduct.variations
      ? prismaProduct.variations
          .map((v: any) => ({
            regular: v.regularPrice != null ? Number(v.regularPrice) : null,
            sale: v.salePrice != null ? Number(v.salePrice) : null,
          }))
          .filter((p: { regular: number | null }) => p.regular !== null)
      : [];

  let regularPrice: string;
  let salePrice: string;

  if (variationPrices.length > 0) {
    const minRegular = Math.min(...variationPrices.map((p: { regular: number }) => p.regular));
    const minEffective = Math.min(
      ...variationPrices.map((p: { regular: number; sale: number | null }) => (p.sale && p.sale > 0 ? p.sale : p.regular))
    );
    regularPrice = String(minRegular);
    salePrice = minEffective < minRegular ? String(minEffective) : "";
  } else {
    regularPrice = prismaProduct.regularPrice ? String(prismaProduct.regularPrice) : "0";
    salePrice = prismaProduct.salePrice ? String(prismaProduct.salePrice) : "";
  }

  const price = salePrice ? salePrice : regularPrice;
  const onSale = Boolean(salePrice);

  // Map categories
  const categories = prismaProduct.categories
    ? prismaProduct.categories.map((pc: any) => ({
        id: pc.category.id,
        name: pc.category.name,
        slug: pc.category.slug,
        // Penanda kategori utama ikut dibawa supaya breadcrumb dan URL kanonik
        // punya satu jalur yang jelas saat produk berada di beberapa cabang.
        primary: Boolean(pc.isPrimary),
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
    status: STATUS_TO_WOO[prismaProduct.status as keyof typeof STATUS_TO_WOO] ?? "draft",
    description: prismaProduct.description || "",
    short_description: prismaProduct.shortDescription || "",
    sku: prismaProduct.sku || "",
    date_created: prismaProduct.createdAt?.toISOString() || new Date().toISOString(),
    date_modified: prismaProduct.updatedAt?.toISOString() || new Date().toISOString(),
    price,
    regular_price: regularPrice,
    sale_price: salePrice,
    on_sale: onSale,
    date_on_sale_from_gmt: null,
    date_on_sale_to_gmt: null,
    stock_status: prismaProduct.stockStatus
      ? STOCK_STATUS_TO_WOO[prismaProduct.stockStatus as keyof typeof STOCK_STATUS_TO_WOO] ?? "instock"
      : "instock",
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
