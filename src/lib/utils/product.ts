import type { Product as WooProduct } from "@/types/woocommerce";
import { HOT_PRODUCT_THRESHOLD } from "@/lib/constants/product";

type ProductBadge = "Hot" | "Deal" | "New" | null;

export function getProductBadge(product: WooProduct): ProductBadge {
  if (product.on_sale) return "Deal";
  if ((product.total_sales ?? 0) > HOT_PRODUCT_THRESHOLD) return "Hot";
  return null;
}

export function getStockStatus(product: WooProduct): "instock" | "lowstock" | "outofstock" {
  if (product.stock_status === "outofstock") return "outofstock";
  if (product.stock_quantity !== null && product.stock_quantity <= 5) return "lowstock";
  return "instock";
}
