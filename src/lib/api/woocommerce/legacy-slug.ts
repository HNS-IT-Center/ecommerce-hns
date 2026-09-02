import { unstable_cache } from "next/cache"

import { getPrisma } from "@/lib/prisma/client"

/**
 * Pencarian alamat produk LAMA (slug WooCommerce) untuk redirect permanen
 * (`permanentRedirect` → HTTP 308, yang Google perlakukan setara 301).
 *
 * Latar: sampai 13 September 2026 katalog dilayani WordPress di
 * `hnsitcenter.id`. 1.015 produk punya slug berbeda antara Woo dan store —
 * sebagian karena slug Woo terpotong (`...b760m-a-wi-...`), salah warna, atau
 * cuma berisi angka (`3250`). Slug store yang lebih benar dipertahankan, dan
 * yang lama disimpan di kolom `products.woo_slug` supaya alamat yang sudah
 * beredar (hasil pencarian Google, tautan yang dibagikan, bookmark) tetap
 * mendarat di produk yang tepat.
 *
 * Peta ini menempel di baris produknya sendiri, bukan berkas yang di-generate
 * saat build: slug tujuan dibaca dari kolom `slug` di baris yang sama pada saat
 * redirect terjadi, jadi staff yang mengganti slug lewat admin tidak pernah
 * membuat petanya basi. Peta yang dibekukan saat build akan menunjuk alamat
 * mati begitu ada yang mengubah slug — dan redirect permanen yang salah
 * di-cache browser secara permanen.
 */
export type LegacySlugTarget =
  /** Produk ditemukan dan layak dibuka — arahkan ke slug barunya. */
  | { kind: "product"; slug: string }
  /**
   * Produk ditemukan tapi tidak terbit (DRAFT/PRIVATE). 15 produk berada di
   * keadaan ini: 9 produk baru Ugreen/Insta360 yang belum diterbitkan, dan 6
   * yang sengaja disembunyikan. Alamat lamanya masih hidup di WooCommerce, jadi
   * membiarkannya 404 membuang pengunjung yang datang dari Google.
   */
  | { kind: "shop" }
  /** Tidak ada di peta — pemanggil melanjutkan ke 404 seperti biasa. */
  | { kind: "none" }

/**
 * Cari produk berdasarkan alamat LAMA-nya.
 *
 * HANYA dipanggil setelah pencarian `slug` biasa gagal — lihat catatan urutan
 * di `app/product/[slug]/page.tsx`. Memanggilnya lebih awal akan membuat setiap
 * kunjungan produk membayar satu query tambahan, padahal 99% kunjungan tidak
 * membutuhkannya.
 *
 * Hasilnya di-cache 1 jam. Isi `woo_slug` praktis tidak pernah berubah setelah
 * cutover — ia adalah catatan sejarah, bukan data hidup — sementara alamat lama
 * yang masih beredar di indeks Google akan terus diakses berbulan-bulan.
 */
export async function findProductByLegacySlug(
  legacySlug: string,
): Promise<LegacySlugTarget> {
  // Slug kosong tidak pernah sah, dan membiarkannya masuk berarti query yang
  // pasti tidak menghasilkan apa-apa.
  if (legacySlug.trim() === "") return { kind: "none" }

  /**
   * Parameter rute sampai ke sini masih TER-ENCODE — jangan andaikan Next.js
   * sudah men-decode-nya.
   *
   * Terukur di Next.js 16.2: `/product/...2-5%E2%80%B3-480gb` tiba sebagai
   * string 49 karakter yang masih memuat `%E2%80%B3`, bukan 41 karakter dengan
   * `″` di dalamnya. Kolom `woo_slug` menyimpan bentuk ter-decode, jadi tanpa
   * baris ini 157 alamat lama bermuatan simbol inci tidak akan pernah cocok —
   * dan gagalnya diam-diam, cuma terlihat sebagai 404 biasa.
   */
  let dicari = legacySlug
  try {
    dicari = decodeURIComponent(legacySlug)
  } catch {
    // Persen-encoding cacat (mis. `%zz`). Pakai apa adanya: lebih baik gagal
    // mencocokkan satu alamat daripada melempar dan menjatuhkan halaman 404.
  }

  const fetcher = unstable_cache(
    async (): Promise<LegacySlugTarget> => {
      const product = await getPrisma().product.findFirst({
        // `woo_slug` sengaja TIDAK unique: satu alamat lama bisa tersimpan di
        // lebih dari satu baris kalau katalog lama punya induk dan varian yang
        // berbagi slug. `findFirst` memilih satu secara deterministik lewat
        // urutan id — pilihan mana pun mengarah ke produk yang sama bagi
        // pembeli, dan keunikan alamat yang dituju tetap dijaga kolom `slug`.
        where: { wooSlug: dicari },
        orderBy: { id: "asc" },
        select: { slug: true, status: true },
      })

      if (product === null) return { kind: "none" }

      // Produk ada tapi tidak terbit: halaman tujuannya akan 404. Lempar ke
      // katalog, bukan ke halaman mati.
      if (product.status !== "PUBLISHED") return { kind: "shop" }

      return { kind: "product", slug: product.slug }
    },
    [`legacy-slug-${dicari}`],
    { revalidate: 3600, tags: ["legacy-slug"] },
  )

  return fetcher()
}
