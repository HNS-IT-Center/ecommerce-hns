import type { Product as WooProduct } from "@/types/woocommerce";
import { HOT_PRODUCT_THRESHOLD } from "@/lib/constants/product";

type ProductBadge = "Hot" | "Deal" | "New" | null;

export function getProductBadge(product: WooProduct): ProductBadge {
  if (product.on_sale) return "Deal";
  if ((product.total_sales ?? 0) > HOT_PRODUCT_THRESHOLD) return "Hot";
  return null;
}

/**
 * Warna badge dialirkan lewat token `--card-badge-*` supaya Theme Editor bisa
 * menimpanya per-scope (lihat `.theme-card` di globals.css). Nilai defaultnya
 * disetel sama persis dengan warna sebelumnya, jadi tanpa tema aktif tampilannya
 * tidak berubah.
 *
 * Kelasnya ditulis utuh sebagai string literal, bukan dirangkai (`bg-${x}`),
 * karena pemindai Tailwind hanya mengenali kelas yang tertulis lengkap.
 */
export function getBadgeColorClass(badge: "Hot" | "Deal" | "New"): string {
  switch (badge) {
    // Tetap `bg-sale-red` (ramp accent), BUKAN `--card-badge-sale` yang dipakai
    // badge terlipat. Keduanya memang beda warna sejak awal, dan menyamakannya
    // di sini akan mengubah tampilan — di luar lingkup refactor ini.
    case "Deal":
      return "bg-sale-red";
    case "Hot":
      return "bg-(--card-badge-hot)";
    case "New":
      return "bg-(--card-badge-new)";
  }
}

export function getStockStatus(product: WooProduct): "instock" | "lowstock" | "outofstock" {
  if (product.stock_status === "outofstock") return "outofstock";
  if (product.stock_quantity !== null && product.stock_quantity <= 5) return "lowstock";
  return "instock";
}

export type VideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string };

/**
 * Thumbnail resmi YouTube untuk dipakai sebagai poster video di galeri.
 *
 * Hanya YouTube yang punya thumbnail beralamat tetap tanpa perlu memanggil API.
 * Vimeo memerlukan panggilan oEmbed dan file R2 tidak punya thumbnail sama
 * sekali, jadi keduanya mengembalikan `null` — galeri jatuh ke foto utama
 * produk sebagai poster.
 *
 * `hqdefault` dipilih, bukan `maxresdefault`: yang terakhir tidak dibuat untuk
 * semua video dan mengembalikan 404 pada video lama/resolusi rendah, sementara
 * `hqdefault` selalu ada.
 */
export function getVideoPosterUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
    }
    if (host === "youtu.be") {
      const videoId = parsed.pathname.slice(1);
      return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
    }

    return null;
  } catch {
    return null;
  }
}

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
