import type { MetadataRoute } from "next"

import { INDEXABLE_HOSTS, requestHostname } from "@/lib/utils/indexable-host"

/**
 * Aturan crawler, ditentukan dari HOST REQUEST.
 *
 * Peta lingkungan, alasan memakai host request alih-alih
 * `NEXT_PUBLIC_SITE_URL`, dan kenapa aturannya gagal-tertutup semuanya ada di
 * `lib/utils/indexable-host.ts` — daftarnya dipakai bersama `app/sitemap.ts`
 * supaya keduanya tidak pernah berselisih.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const hostname = await requestHostname()

  // Staging (`store.hnsitcenter.id`), localhost, dan host tak dikenal.
  if (!INDEXABLE_HOSTS.includes(hostname)) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // Panel admin tidak pernah pantas muncul di hasil pencarian, walau
        // aksesnya sendiri sudah dijaga (`src/proxy.ts` menolak permintaan tanpa
        // sesi, termasuk cookie bertanda tangan palsu).
        "/admin",
        /**
         * Tautan penawaran pelanggan (`/q/<token>`) dan halaman cetaknya.
         *
         * Keduanya berisi nama pelanggan dan nilai transaksinya. Yang menjaga
         * mereka adalah token acak di alamatnya, BUKAN baris ini — baris ini
         * hanya mencegah crawler yang terlanjur menemukan satu tautan (dari
         * riwayat chat yang tersinkron, dari ekstensi peramban) menerbitkannya
         * ke hasil pencarian. Kedua halaman juga memasang `robots: noindex`
         * sendiri, karena berkas ini tidak berlaku untuk crawler yang memang
         * tidak membacanya.
         */
        "/q",
        "/build-pc/print",
      ],
    },
    sitemap: `https://${hostname}/sitemap.xml`,
  }
}
