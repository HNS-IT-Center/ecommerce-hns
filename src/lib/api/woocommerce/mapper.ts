import type { Product as WooProduct } from "@/types/woocommerce";
import type { Product as UIProduct } from "@/components/ui/product-card";
import { getProductBadge } from "@/lib/utils/product";

export function mapWooProductToUI(woo: WooProduct): UIProduct {
  const imageUrl = woo.images?.[0]?.src ?? "/images/placeholder.svg";

  const brandName = woo.brands?.[0]?.name ?? "";

  const categoryName = woo.categories?.[0]?.name ?? "";

  // price = harga jual aktual (sale_price jika sedang diskon, regular_price jika tidak)
  const regularPrice = parseInt(woo.regular_price || woo.price || "0", 10);
  const salePrice = woo.sale_price ? parseInt(woo.sale_price, 10) : undefined;
  const price = salePrice ?? regularPrice;

  // `_member_price` dari meta WooCommerce sengaja TIDAK dibaca lagi. Angkanya
  // ditampilkan sebagai "Member: Rp X" di kartu produk, padahal tidak ada
  // mekanisme member di situs ini — harga yang tidak pernah bisa didapat siapa
  // pun. Lihat CLAUDE.md §2.7.

  return {
    id: String(woo.id),
    slug: woo.slug,
    name: woo.name,
    brand: brandName,
    category: categoryName,
    price,
    regular_price: regularPrice,
    on_sale: woo.on_sale,
    image_url: imageUrl,
    sold: woo.total_sales ?? 0,
    badge: getProductBadge(woo),
    stock: woo.stock_quantity ?? (woo.stock_status === "instock" ? 99 : 0),
    type: woo.type,
    average_rating: parseFloat(woo.average_rating || "0"),
    rating_count: woo.rating_count ?? 0,
    images:
      woo.images?.map((img) => ({ src: img.src, alt: img.alt || woo.name })) ||
      [],
  };
}
