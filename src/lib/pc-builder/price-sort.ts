import "server-only"

import { Prisma } from "@prisma/client"

import { getPrisma } from "@/lib/prisma/client"

/**
 * Pengurutan "harga kartu" untuk grid komponen — dipakai wizard pelanggan
 * (`fetchBuilderProducts`) DAN panel admin PC Prebuild
 * (`searchPrebuildProducts`).
 *
 * ## Kenapa tidak diserahkan ke `ORDER BY`
 *
 * Harga yang tampil di kartu bukan isi satu kolom. Ia `salePrice` kalau
 * obralnya masih berlaku, dan untuk induk VARIABLE — yang harganya sendiri
 * sering nol — ia harga varian termurah yang masih ada stoknya. Dua aturan itu
 * tidak bisa dinyatakan sebagai satu kolom untuk diurutkan Prisma;
 * `orderBy: { regularPrice }` akan menaruh seluruh produk bervarian di ujung
 * daftar dengan harga nol.
 *
 * Karena itu peringkatnya disusun di sini: satu kueri ringan atas SELURUH
 * kandidat yang lolos filter (tanpa gambar, deskripsi, maupun atribut), lalu
 * halamannya diambil dari urutan itu. Mengurutkan hanya 20 baris per halaman
 * akan salah — yang termurah bisa berada di halaman mana pun.
 *
 * ## Kenapa `priceOf` diserahkan pemanggil
 *
 * Aturan stoknya berbeda: wizard pelanggan menghormati sakelar tampilan stok
 * di `/admin/produk` (`StockDisplayMode`), panel admin tidak. Stok ikut
 * menentukan varian mana yang sah dipakai sebagai harga kartu induk, jadi
 * rumus harganya tidak bisa dipatok di sini. Yang dibagi adalah cara
 * MENGURUTKAN dan memenggal halamannya, bukan cara menghitung harganya.
 */

/**
 * Kolom minimum yang dibutuhkan untuk menilai harga kartu. Sengaja tidak
 * menarik gambar, deskripsi, atau atribut: kueri ini berjalan atas seluruh
 * kandidat, bukan atas satu halaman.
 */
export const PILIH_KANDIDAT_HARGA = {
  id: true,
  regularPrice: true,
  salePrice: true,
  saleEndDate: true,
  variations: {
    where: { status: "PUBLISHED" },
    select: {
      regularPrice: true,
      salePrice: true,
      saleEndDate: true,
      stockQty: true,
      stockStatus: true,
    },
  },
} satisfies Prisma.ProductSelect

export type KandidatHarga = Prisma.ProductGetPayload<{ select: typeof PILIH_KANDIDAT_HARGA }>

/**
 * Id produk untuk satu halaman, terurut menurut harga kartu.
 *
 * `hasMore` dihitung dari jumlah kandidat seluruhnya, bukan dari jumlah baris
 * yang terbawa — di jalur ini halamannya dipenggal setelah pengurutan, jadi
 * trik "ambil satu lebih banyak" tidak berlaku.
 */
export async function pageIdsByCardPrice({
  where,
  skip,
  limit,
  direction,
  priceOf,
}: {
  where: Prisma.ProductWhereInput
  skip: number
  limit: number
  direction: "asc" | "desc"
  priceOf: (row: KandidatHarga) => number
}): Promise<{ ids: number[]; hasMore: boolean }> {
  const kandidat = await getPrisma().product.findMany({
    where,
    select: PILIH_KANDIDAT_HARGA,
  })

  const arah = direction === "asc" ? 1 : -1
  const berurut = kandidat
    .map((p) => ({ id: p.id, price: priceOf(p) }))
    // `id` sebagai pemecah seri: tanpa itu urutan dua barang berharga sama bisa
    // bertukar antar halaman, dan barang yang sama muncul dua kali (atau tidak
    // sama sekali) saat "Muat lebih banyak" ditekan.
    .sort((a, b) => (a.price === b.price ? a.id - b.id : (a.price - b.price) * arah))

  return {
    ids: berurut.slice(skip, skip + limit).map((x) => x.id),
    hasMore: berurut.length > skip + limit,
  }
}

/**
 * Susun ulang baris hasil `IN (...)` mengikuti urutan id yang diminta.
 *
 * `WHERE id IN (...)` tidak menjamin urutan apa pun, jadi tanpa ini peringkat
 * harga yang sudah dihitung di atas hilang begitu barisnya diambil.
 */
export function reorderByIds<T extends { id: number }>(rows: T[], ids: number[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return ids.map((id) => byId.get(id)).filter((r): r is T => r !== undefined)
}
