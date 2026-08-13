import "server-only"

import { headers } from "next/headers"

/**
 * Domain mana yang boleh dibaca mesin pencari.
 *
 * SATU tempat, dipakai `app/robots.ts` DAN `app/sitemap.ts`. Kalau daftarnya
 * disalin ke dua berkas, cepat atau lambat salah satunya diperbarui sendirian
 * dan robots melarang sesuatu yang sitemap masih iklankan — atau sebaliknya.
 *
 * **Peta lingkungan (dikonfirmasi user 13 Agustus 2026):**
 *
 * | Host | Apa | Boleh diindeks |
 * |---|---|---|
 * | `store.hnsitcenter.id` | **Staging** Next.js — tempat menguji hal setengah jadi | **TIDAK PERNAH** |
 * | `hnsitcenter.id` | **Produksi** — masih WordPress lama hari ini | Ya (relevan saat Next.js menggantikannya) |
 * | lainnya (localhost, preview, host tak dikenal) | — | Tidak |
 *
 * Staging tidak boleh terbaca Google **dalam kondisi apa pun**: isinya
 * setengah jadi, dan kalaupun tidak, ia akan bersaing dengan situs asli di
 * hasil pencarian atas nama domain yang sama.
 *
 * **Kenapa host request, BUKAN `NEXT_PUBLIC_SITE_URL`.** Env itu terbukti bisa
 * salah tanpa ada yang menyadarinya — pada 13 Agustus 2026 nilainya di
 * deployment produksi masih `http://localhost:3000`, entah sejak kapan.
 * Penjaga yang bergantung pada nilai yang sama-sama bisa salah tidak menjaga
 * apa pun: kalau env-nya salah lagi nanti, staging akan terbuka lagi dan tidak
 * ada yang tahu sampai halamannya muncul di Google.
 *
 * Host request tidak bisa salah dengan cara itu. Ia selalu menggambarkan
 * domain yang benar-benar sedang melayani permintaan.
 *
 * **GAGAL TERTUTUP.** Host yang tidak dikenali mendapat perlakuan "tidak boleh
 * diindeks". Arah ini dipilih sadar: salah menutup berarti satu lingkungan
 * tidak terindeks sampai ada yang menyadarinya; salah membuka berarti alamat
 * yang rusak menyebar di hasil pencarian dan butuh berminggu-minggu untuk
 * dibersihkan lewat Search Console.
 *
 * Kalau domain produksi berubah, tambahkan di sini — bukan dengan melonggarkan
 * syaratnya.
 */
export const INDEXABLE_HOSTS = ["hnsitcenter.id", "www.hnsitcenter.id"]

/** Hostname dari request yang sedang berjalan, huruf kecil, tanpa port. */
export async function requestHostname(): Promise<string> {
  try {
    const headerList = await headers()
    // `x-forwarded-host` lebih dulu: di balik CDN Hostinger (`Server: hcdn`)
    // maupun Vercel, `host` berisi host internal, bukan domain publik.
    const rawHost = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? ""
    return rawHost.split(",")[0].trim().replace(/:\d+$/, "").toLowerCase()
  } catch {
    // headers() tidak tersedia (mis. saat build statis) — kembalikan kosong
    // dan biarkan pemanggil jatuh ke perlakuan gagal-tertutup.
    return ""
  }
}

/** Apakah permintaan ini datang ke domain yang boleh diindeks mesin pencari. */
export async function isIndexableRequest(): Promise<boolean> {
  return INDEXABLE_HOSTS.includes(await requestHostname())
}
