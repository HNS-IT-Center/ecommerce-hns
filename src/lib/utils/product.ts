import type { Product as WooProduct } from "@/types/woocommerce";
import { HOT_PRODUCT_THRESHOLD } from "@/lib/constants/product";

type ProductBadge = "Hot" | "Deal" | "New" | null;

export function getProductBadge(product: WooProduct): ProductBadge {
  if (product.on_sale) return "Deal";
  if ((product.total_sales ?? 0) > HOT_PRODUCT_THRESHOLD) return "Hot";
  return null;
}

export function getBadgeColorClass(badge: "Hot" | "Deal" | "New"): string {
  switch (badge) {
    case "Deal":
      return "bg-sale-red";
    case "Hot":
      return "bg-orange-500";
    case "New":
      return "bg-blue-500";
  }
}

export function getStockStatus(product: WooProduct): "instock" | "lowstock" | "outofstock" {
  if (product.stock_status === "outofstock") return "outofstock";
  if (product.stock_quantity !== null && product.stock_quantity <= 5) return "lowstock";
  return "instock";
}

export type VideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string };

/**
 * Video produk bisa berupa link YouTube/Vimeo (butuh <iframe> embed) atau
 * file langsung hasil upload ke R2 (bisa diputar lewat <video> biasa).
 * Deteksi dari host URL-nya, bukan dari field terpisah — form admin cuma
 * menyimpan satu URL video apapun sumbernya.
 */
export function getVideoEmbed(url: string): VideoEmbed | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return { kind: "iframe", src: `https://www.youtube.com/embed/${videoId}` };
      return null;
    }
    if (host === "youtu.be") {
      const videoId = parsed.pathname.slice(1);
      if (videoId) return { kind: "iframe", src: `https://www.youtube.com/embed/${videoId}` };
      return null;
    }
    if (host === "vimeo.com") {
      const videoId = parsed.pathname.slice(1);
      if (videoId) return { kind: "iframe", src: `https://player.vimeo.com/video/${videoId}` };
      return null;
    }

    return { kind: "file", src: url };
  } catch {
    return null;
  }
}
