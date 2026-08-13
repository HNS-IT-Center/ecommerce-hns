import type { MetadataRoute } from "next";
import { getProductsForSitemap } from "@/lib/api/woocommerce/products";
import { getCategories } from "@/lib/api/woocommerce/categories";
import { resolveSiteUrl } from "@/lib/utils/site-url";

/**
 * Peta situs untuk mesin pencari.
 *
 * Dibangun ulang berkala, bukan sekali saat build: katalog berubah tiap hari
 * dan peta yang dibekukan saat deploy akan menua diam-diam — produk baru tidak
 * pernah masuk sampai deploy berikutnya kebetulan terjadi.
 */
export const revalidate = 3600;

/**
 * Batas jumlah produk yang dipetakan.
 *
 * Protokol sitemap membatasi 50.000 URL per berkas. Katalog ini sekitar 2.800
 * produk, jadi masih jauh — angka ini ada sebagai rem kalau katalog tumbuh
 * berlipat, supaya berkasnya tidak diam-diam melewati batas dan ditolak utuh
 * oleh Google. Kalau suatu saat benar-benar mendekati, pecah jadi beberapa
 * berkas lewat `generateSitemaps`, jangan sekadar naikkan angkanya.
 */
const MAX_PRODUCTS = 5000;

/**
 * Halaman yang isinya ditulis tangan dan jarang berubah.
 *
 * `priority` di sini adalah bobot RELATIF antar halaman situs ini sendiri —
 * bukan janji peringkat, dan tidak berpengaruh terhadap situs lain. Beranda dan
 * katalog dapat porsi terbesar karena dari sanalah sebagian besar penjelajahan
 * dimulai; halaman kebijakan paling kecil karena tidak dimaksudkan menarik
 * pengunjung dari pencarian.
 *
 * Yang sengaja TIDAK dimasukkan:
 * - `/admin` — sudah ditutup di robots.ts, dan belum berpelindung login.
 * - `/search` — hasil pencarian sudah `robots: { index: false }` di halamannya.
 * - `/cart`, `/checkout`, `/account`, `/login`, `/register` — khusus satu
 *   pengguna, tidak ada gunanya di hasil pencarian.
 * - `/build-pc/print` — keluaran cetak, bukan halaman untuk dibaca.
 */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "", changeFrequency: "daily", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/build-pc", changeFrequency: "weekly", priority: 0.9 },
  { path: "/tools", changeFrequency: "monthly", priority: 0.8 },
  { path: "/stores", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/support", changeFrequency: "monthly", priority: 0.5 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.5 },
  { path: "/kebijakan/pengiriman", changeFrequency: "yearly", priority: 0.3 },
  { path: "/kebijakan/pengembalian-barang", changeFrequency: "yearly", priority: 0.3 },
  { path: "/kebijakan/pengembalian-dana", changeFrequency: "yearly", priority: 0.3 },
  { path: "/kebijakan/pembatalan-pesanan", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Dari host request (lewat daftar izin di `resolveSiteUrl`), BUKAN dari
  // `NEXT_PUBLIC_SITE_URL`.
  //
  // Env itu terbukti masih `http://localhost:3000` di deployment produksi pada
  // 13 Agustus 2026, dan akibatnya SELURUH 2.886 URL di peta ini menunjuk
  // `localhost` — daftar alamat yang tidak bisa dijangkau siapa pun, disajikan
  // atas nama domain HNS. Peta situs yang salah alamat lebih buruk daripada
  // tidak punya peta sama sekali.
  //
  // Host request tidak bisa salah dengan cara itu: ia selalu menggambarkan
  // domain yang benar-benar sedang melayani permintaan.
  const baseUrl = await resolveSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Database bisa saja tidak terjangkau saat peta ini dibangun ulang. Kalau itu
  // terjadi, kirim halaman statis apa adanya alih-alih melempar error: peta
  // yang sebagian jauh lebih berguna bagi crawler daripada balasan 500 yang
  // membuat SELURUH peta hilang, termasuk halaman yang sebetulnya baik-baik saja.
  let productEntries: MetadataRoute.Sitemap = [];
  let categoryEntries: MetadataRoute.Sitemap = [];

  try {
    const [products, categories] = await Promise.all([
      getProductsForSitemap(MAX_PRODUCTS),
      getCategories({ hideEmpty: true, perPage: 500 }),
    ]);

    productEntries = products.map((product) => ({
      url: `${baseUrl}/product/${product.slug}`,
      // Tanggal perubahan produk yang sebenarnya. Memakai "sekarang" untuk
      // semua produk akan memberi tahu crawler bahwa 2.800 halaman berubah tiap
      // jam, dan sinyal yang jelas keliru begitu justru membuat tanggalnya
      // diabaikan sama sekali.
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    categoryEntries = categories.map((category) => ({
      url: `${baseUrl}/category/${category.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("Sitemap: gagal memuat produk/kategori", error);
  }

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
