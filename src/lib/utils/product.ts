import type { Product as WooProduct } from "@/types/woocommerce";
import { HOT_PRODUCT_THRESHOLD, NEW_PRODUCT_MAX_AGE_DAYS } from "@/lib/constants/product";

type ProductBadge = "Hot" | "Deal" | "New" | null;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Apakah produk masih di dalam jendela "New" (lihat `NEW_PRODUCT_MAX_AGE_DAYS`).
 *
 * `date_created` dari WooCommerce adalah waktu LOKAL toko tanpa penanda zona
 * (`"2026-08-11T09:30:00"`), yang di JavaScript diurai sebagai waktu lokal
 * mesin yang menjalankannya. Server produksi lazim berjalan di UTC sementara
 * tokonya di WIB, jadi selisihnya sampai 7 jam — tidak berarti pada ambang
 * 15 hari, dan tetap tidak berarti selama pembandingnya juga waktu lokal.
 *
 * Tanggal yang tidak bisa diurai menghasilkan `NaN`; perbandingan apapun
 * dengan `NaN` bernilai false, jadi produk itu otomatis tidak ber-badge —
 * gagal ke sisi aman, bukan memberi "New" pada produk lama.
 */
function isNewProduct(product: WooProduct): boolean {
  if (!product.date_created) return false;

  const createdAt = new Date(product.date_created).getTime();
  const ageInDays = (Date.now() - createdAt) / MS_PER_DAY;

  return ageInDays >= 0 && ageInDays <= NEW_PRODUCT_MAX_AGE_DAYS;
}

/**
 * Kartu hanya menampilkan SATU badge, jadi urutan di bawah adalah urutan
 * prioritas — bukan sekadar rangkaian `if`.
 *
 * "Deal" tetap di atas "New": diskon adalah alasan beli yang lebih kuat
 * daripada kebaruan, dan mendahulukan "New" akan menyembunyikan badge diskon
 * pada produk baru yang sedang promo — persis kartu yang paling ingin dijual.
 * Konsekuensinya produk baru yang sedang diskon tampil "Deal", bukan "New".
 *
 * "New" ditaruh di atas "Hot" karena keduanya nyaris tidak pernah bentrok:
 * "Hot" butuh penjualan di atas ambang, yang sulit dicapai produk berumur
 * di bawah 15 hari.
 */
export function getProductBadge(product: WooProduct): ProductBadge {
  if (product.on_sale) return "Deal";
  if (isNewProduct(product)) return "New";
  if ((product.total_sales ?? 0) > HOT_PRODUCT_THRESHOLD) return "Hot";
  return null;
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
