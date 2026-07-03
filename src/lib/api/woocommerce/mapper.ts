import type { Product as WooProduct } from "@/types/woocommerce";
import type { Product as UIProduct } from "@/components/ui/product-card";
import { getProductBadge } from "@/lib/utils/product";

export function mapWooProductToUI(woo: WooProduct): UIProduct {
  const imageUrl = woo.images?.[0]?.src ?? "/images/placeholder.svg";

  const brandAttr = woo.attributes?.find(
    (a) => a.slug === "merk" || a.slug === "brand" || a.slug === "pa_brand",
  );
  const brandName = brandAttr?.options?.[0] ?? "";

  const categoryName = woo.categories?.[0]?.name ?? "";

  // price = harga jual aktual (sale_price jika sedang diskon, regular_price jika tidak)
  const regularPrice = parseInt(woo.regular_price || woo.price || "0", 10);
  const salePrice = woo.sale_price ? parseInt(woo.sale_price, 10) : undefined;
  const price = salePrice ?? regularPrice;

  // member_price = harga eksklusif member, terpisah dari sale price publik
  const memberPriceMeta = woo.meta_data?.find((m) => m.key === "_member_price");
  const memberPrice = memberPriceMeta?.value
    ? parseInt(String(memberPriceMeta.value), 10)
    : undefined;

  return {
    id: String(woo.id),
    slug: woo.slug,
    name: woo.name,
    brand: brandName,
    category: categoryName,
    price,
    member_price: memberPrice,
    image_url: imageUrl,
    sold: woo.total_sales ?? 0,
    badge: getProductBadge(woo),
    stock: woo.stock_quantity ?? (woo.stock_status === "instock" ? 99 : 0),
  };
}
