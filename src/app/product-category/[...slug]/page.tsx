import { permanentRedirect } from "next/navigation"

import { findCategoryByLegacySlug } from "@/lib/api/woocommerce/legacy-category"

/**
 * Redirect permanen dari alamat KATEGORI lama WooCommerce ke /shop yang sudah
 * tersaring. (`permanentRedirect` = HTTP 308; Google memperlakukannya setara 301.)
 *
 * Catch-all (`[...slug]`), bukan `[slug]`: WooCommerce menerbitkan kategori
 * dalam bentuk datar DAN bertingkat, dan yang bertingkat adalah kanonik untuk
 * 124 dari 154 kategori — itu yang diindeks Google. Alasan lengkapnya di
 * `legacy-category.ts`.
 *
 * Halaman ini TIDAK pernah merender apa pun: setiap cabang berakhir di
 * redirect. Karena itu tidak ada `notFound()` — alamat kategori yang tidak
 * dikenal pun lebih baik mendarat di /shop daripada 404, sebab pengunjungnya
 * datang dari hasil pencarian dan jelas sedang mencari barang.
 */
type Props = {
  params: Promise<{ slug: string[] }>
}

export default async function LegacyCategoryPage({ params }: Props) {
  const { slug } = await params

  const target = await findCategoryByLegacySlug(slug)

  /**
   * Permanen (`permanentRedirect` → HTTP 308), BUKAN 302. Google memindahkan
   * peringkat halaman lama ke alamat baru hanya untuk redirect permanen — dan
   * memperlakukan 308 setara 301 untuk itu; 302 menandakan "sementara" dan
   * membiarkan peringkatnya menggantung di alamat yang mati.
   *
   * Berbeda dari jalur produk yang memakai 307 untuk produk tidak terbit:
   * di sini ketiga cabang permanen. Kategori tidak punya keadaan "mungkin
   * terbit lagi nanti" — WooCommerce dimatikan 13 September dan alamat ini
   * tidak akan pernah hidup kembali.
   */
  if (target.kind === "category") {
    permanentRedirect(`/shop?category=${encodeURIComponent(target.slug)}`)
  }

  if (target.kind === "brand") {
    permanentRedirect(`/shop?brand=${encodeURIComponent(target.slug)}`)
  }

  permanentRedirect("/shop")
}
