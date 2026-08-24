import "server-only"

import { getPrisma } from "@/lib/prisma/client"

/**
 * Bahan mentah yang dikirim ke Groq untuk menganalisis performa satu paket.
 *
 * Terpisah dari `resolve.ts` karena kebutuhannya berbeda: halaman butuh harga,
 * stok, slug, dan foto; analisis butuh NAMA KATEGORI — satu-satunya petunjuk
 * yang tidak dipakai halaman mana pun, dan justru yang paling menolong model
 * mengenali komponen ketika nama langkah yang ditulis staff kabur ("Bagian 3").
 *
 * ## Kenapa tidak di-cache
 *
 * Dipanggil sekali per klik tombol "Hitung Performa" oleh staff yang sedang
 * menyunting paket itu. Data basi di sini berarti analisis dibuat atas produk
 * yang bukan produk saat ini — dan hasilnya tersimpan berikut sidik jarinya,
 * jadi kekeliruannya ikut tersimpan. `unstable_cache` di jalur ini menukar
 * ketepatan dengan penghematan yang tidak berarti pada frekuensi sejarang itu.
 */
export type AnalysisProduct = {
  id: number
  name: string
  /** Harga katalog yang berlaku — dibaca sama seperti `resolve.ts`, tanpa rumus apa pun. */
  price: number
  /** Nama kategori, kategori utama lebih dulu. */
  categories: string[]
}

export async function getAnalysisProducts(
  ids: number[]
): Promise<Map<number, AnalysisProduct>> {
  const unik = [...new Set(ids)].filter((id) => Number.isFinite(id) && id > 0)
  if (unik.length === 0) return new Map()

  const rows = await getPrisma().product.findMany({
    where: { id: { in: unik } },
    select: {
      id: true,
      name: true,
      regularPrice: true,
      salePrice: true,
      categories: {
        select: {
          isPrimary: true,
          category: { select: { name: true } },
        },
      },
    },
  })

  return new Map(
    rows.map((p) => {
      const sale = p.salePrice ? Number(p.salePrice) : 0
      const regular = p.regularPrice ? Number(p.regularPrice) : 0

      return [
        p.id,
        {
          id: p.id,
          name: p.name,
          // Aturan harga yang sama persis dengan `resolve.ts` dan
          // `fetchBuilderProducts`: salePrice kalau ada, kalau tidak
          // regularPrice. Tidak ada perkalian, tidak ada persentase
          // (CLAUDE.md §2.7).
          price: sale > 0 ? sale : regular,
          categories: [...p.categories]
            .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
            .map((c) => c.category.name),
        },
      ]
    })
  )
}
