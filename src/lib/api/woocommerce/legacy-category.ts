import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

/**
 * Pencarian alamat KATEGORI lama (WooCommerce) untuk redirect permanen
 * (`permanentRedirect` → HTTP 308, yang Google perlakukan setara 301).
 *
 * Pasangan dari `legacy-slug.ts` yang menangani produk. Latar yang sama:
 * sampai 13 September 2026 katalog dilayani WordPress di `hnsitcenter.id`,
 * dan alamat `/product-category/...` yang sudah beredar di hasil pencarian
 * Google harus tetap mendarat di tempat yang benar setelah cutover.
 *
 * ============================================================================
 * KENAPA `[...slug]`, BUKAN `[slug]`
 * ============================================================================
 * WooCommerce menerbitkan kategori dalam DUA bentuk, dan keduanya hidup:
 *
 *   datar       /product-category/motherboard-intel/
 *   bertingkat  /product-category/komponen-pc-nb/motherboard-pc/motherboard-intel/
 *
 * Diukur 2 September 2026 terhadap seluruh 154 kategori: bentuk datar
 * menjawab 200 untuk SEMUANYA, tapi `og:url` mengiklankan bentuk bertingkat
 * sebagai kanonik untuk 124 di antaranya (60 dua segmen, 64 tiga segmen).
 * Yang kanonik itulah yang diindeks Google.
 *
 * Route `[slug]` hanya menangkap satu segmen — 124 alamat kanonik akan 404,
 * justru yang paling banyak beredar. Karena itu catch-all.
 * ============================================================================
 */

/**
 * Slug Woo yang sebenarnya MEREK, bukan kategori.
 *
 * Di WooCommerce merek dijadikan kategori produk; di store ia sudah jadi
 * entitas `Brand` sendiri. 17 alamat ini (436 produk) diarahkan ke filter
 * merek yang SUDAH ADA di `/shop` — tidak ada fitur baru yang dibangun untuk
 * ini.
 *
 * Peta ini sengaja TIDAK disimpan di `categories.woo_slug`: beberapa di
 * antaranya menunjuk merek yang sama (`amd` + `amd-ati-radeon` → `amd`, dua
 * baris `colorful` → `colorful`), jadi akan bertabrakan dengan unique
 * constraint kolom itu.
 *
 * Nilai kanannya adalah `Brand.slug` di store — bukan nama merek. Sudah
 * diverifikasi ada semua per 2 September 2026.
 */
const PETA_MEREK: Record<string, string> = {
  "acer": "acer",
  "advan": "advan",
  "amd": "amd",
  "amd-ati-radeon": "amd",
  "apple": "apple",
  "asus": "asus",
  "axioo": "axioo",
  "colorful": "colorful",
  "colorful-laptop-gaming": "colorful",
  "hp": "hp",
  "intel": "intel",
  "intel-arc": "intel",
  "lenovo": "lenovo",
  "msi-laptop-gaming": "msi",
  "nvidia": "nvidia",
  "playstation": "playstation",
  "rog-laptop-gaming": "rog",
}

export type LegacyCategoryTarget =
  /** Kategori ditemukan — arahkan ke /shop yang tersaring kategori itu. */
  | { kind: "category"; slug: string }
  /** Alamat lama ternyata merek — arahkan ke /shop yang tersaring merek. */
  | { kind: "brand"; slug: string }
  /** Tidak dikenal — jatuhkan ke /shop, jangan 404. */
  | { kind: "shop" }

/**
 * Cari kategori store dari alamat kategori LAMA.
 *
 * Menerima seluruh segmen alamat, lalu mencocokkan **elemen TERAKHIR** saja.
 *
 * Segmen terakhir, bukan path penuh, karena satu baris data harus melayani
 * kedua bentuk alamat (datar dan bertingkat) sekaligus. Segmen induk di
 * alamat lama juga slug WOO (`motherboard-pc`), bukan slug store
 * (`komponen-pc-nb-motherboard`) — mencocokkan path penuh berarti bergantung
 * pada struktur sistem yang justru sedang dimatikan.
 *
 * Terverifikasi 2 September 2026: dari 101 kategori yang dipetakan, tidak ada
 * dua yang segmen terakhirnya sama, jadi pencocokan ini deterministik.
 *
 * Hasilnya di-cache 1 jam. Isi `woo_slug` adalah catatan sejarah — praktis
 * tidak pernah berubah setelah cutover — sementara alamat lama di indeks
 * Google akan terus diakses berbulan-bulan.
 */
export async function findCategoryByLegacySlug(
  segments: string[],
): Promise<LegacyCategoryTarget> {
  const terakhirMentah = segments.at(-1)
  if (!terakhirMentah || terakhirMentah.trim() === "") return { kind: "shop" }

  /**
   * Parameter rute sampai ke sini masih TER-ENCODE — jangan andaikan Next.js
   * sudah men-decode-nya. Pelajaran yang sama sudah dibayar sekali di
   * `legacy-slug.ts`, tempat 157 alamat produk bermuatan simbol inci (`″`)
   * tidak pernah cocok karena `%E2%80%B3` masuk apa adanya.
   */
  let terakhir = terakhirMentah
  try {
    terakhir = decodeURIComponent(terakhirMentah)
  } catch {
    // Persen-encoding cacat (mis. `%zz`). Pakai apa adanya: lebih baik gagal
    // mencocokkan satu alamat daripada melempar dan menjatuhkan halaman.
  }
  terakhir = terakhir.toLowerCase()

  // Merek diperiksa lebih dulu, dan itu GRATIS — peta di memori, tanpa query.
  // Tidak ada slug merek yang juga menjadi `woo_slug` kategori (diverifikasi:
  // 17 slug merek tidak ada satupun di 101 baris kategori), jadi urutan ini
  // tidak pernah membajak kategori yang sah.
  const merek = PETA_MEREK[terakhir]
  if (merek) return { kind: "brand", slug: merek }

  const fetcher = unstable_cache(
    async (): Promise<LegacyCategoryTarget> => {
      const kategori = await getPrisma().category.findFirst({
        where: { wooSlug: terakhir },
        select: { slug: true },
      })

      if (kategori === null) return { kind: "shop" }
      return { kind: "category", slug: kategori.slug }
    },
    [`legacy-category-${terakhir}`],
    { revalidate: 3600, tags: ["legacy-category"] },
  )

  return fetcher()
}
