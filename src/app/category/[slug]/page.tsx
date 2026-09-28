import { redirect } from "next/navigation"

/**
 * Alamat kategori WordPress lama → `/shop?category=<slug>`.
 *
 * `params` adalah Promise dan WAJIB di-`await`. Sampai 25 September 2026 berkas
 * ini menuliskannya sebagai `{ slug: string }` dan membaca `params.slug`
 * langsung — pada Promise, dan hasilnya `undefined`. Setiap URL kategori lama
 * mendarat di `/shop?category=undefined`: slug-nya hilang, padahal URL itulah
 * satu-satunya alasan redirect ini ada.
 *
 * Gagalnya sepenuhnya senyap. Tidak ada error, tidak ada 500 — cuma halaman
 * shop tanpa filter, yang terlihat seperti halaman yang memang begitu. Turbopack
 * tidak memeriksa tipe route ini, jadi `npm run typecheck` pun lolos; yang
 * menangkapnya adalah `next build --webpack`, yang dijalankan karena alasan
 * yang sama sekali lain.
 */
export default async function CategoryRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/shop?category=${encodeURIComponent(slug)}`)
}
