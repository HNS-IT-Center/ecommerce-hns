import type { MetadataRoute } from "next"
import { headers } from "next/headers"

/**
 * Hanya domain produksi yang boleh diindeks mesin pencari.
 *
 * **Kenapa daftar ini eksplisit, bukan "izinkan semua":** berkas ini sempat
 * ditulis ulang menjadi `allow: "/"` tanpa syarat, dengan alasan supaya
 * Lighthouse dan alat SEO bisa memeriksa situs. Akibatnya
 * `store.hnsitcenter.id` — lingkungan staging — terbuka untuk diindeks,
 * PADAHAL `NEXT_PUBLIC_SITE_URL` di sana masih `http://localhost:3000`
 * sehingga seluruh 2.886 URL di `sitemap.xml` menunjuk `localhost`.
 *
 * Kombinasinya yang berbahaya: Google diundang meng-crawl atas nama domain
 * HNS, lalu diberi daftar alamat yang tidak bisa dijangkau siapa pun.
 * Hasilnya halaman error atas nama domain kita, dan staging yang bersaing
 * dengan situs asli di hasil pencarian.
 *
 * **GAGAL TERTUTUP.** Host yang tidak dikenali — termasuk saat env belum
 * disetel atau salah — mendapat `Disallow: /`. Arah ini dipilih sadar:
 * salah menutup berarti satu lingkungan tidak terindeks sampai ada yang
 * menyadarinya; salah membuka berarti alamat yang rusak menyebar di hasil
 * pencarian dan butuh berminggu-minggu untuk dibersihkan.
 *
 * Kalau nanti domain produksi berubah, tambahkan di sini — bukan dengan
 * melonggarkan syaratnya.
 */
const INDEXABLE_HOSTS = ["hnsitcenter.id", "www.hnsitcenter.id"]

export default async function robots(): Promise<MetadataRoute.Robots> {
  // Host request, BUKAN `NEXT_PUBLIC_SITE_URL`. Env itu justru yang terbukti
  // salah di produksi hari ini, dan penjaga yang bergantung pada nilai yang
  // sama-sama bisa salah tidak menjaga apa pun. Host request selalu
  // menggambarkan lingkungan yang benar-benar sedang melayani permintaan.
  let hostname = ""
  try {
    const headerList = await headers()
    // `x-forwarded-host` lebih dulu: di balik CDN Hostinger (`Server: hcdn`)
    // maupun Vercel, `host` berisi host internal, bukan domain publik.
    const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? ""
    hostname = rawHost.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase()
  } catch {
    // headers() tidak tersedia (mis. saat build statis) — biarkan kosong,
    // dan biarkan aturan gagal-tertutup di bawah yang memutuskan.
  }

  if (!INDEXABLE_HOSTS.includes(hostname)) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Panel admin tidak pernah pantas muncul di hasil pencarian, walau
      // aksesnya sendiri sudah dijaga (`src/proxy.ts` menolak permintaan
      // tanpa sesi, termasuk cookie bertanda tangan palsu).
      disallow: "/admin",
    },
    sitemap: `https://${hostname}/sitemap.xml`,
  }
}
