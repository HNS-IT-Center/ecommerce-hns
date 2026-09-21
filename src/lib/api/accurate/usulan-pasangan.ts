import "server-only"

import { getPrisma } from "@/lib/prisma/client"

import {
  bangunIndeks,
  kandidatKembar,
  peringkatKandidat,
  tingkatKeyakinan,
  type Kandidat,
  type Keyakinan,
} from "./pencocokan-nama"

/**
 * Antrean penautan beserta usulan pasangannya.
 *
 * Yang dikerjakan di sini cuma MENGURUTKAN dan MENYEDIAKAN kandidat. Tidak ada
 * satu pun jalur di berkas ini yang menulis tautan — penautan tetap lewat
 * `tautkanKodeAction`, dipicu klik orang. Aturan lengkapnya di docs/13 §5.
 *
 * BIAYANYA SUDAH DIUKUR (21 September 2026, 5.477 produk × 5.033 antrean):
 * bangun indeks 43 ms, memeringkat seluruh antrean 906 ms. Karena itu tidak ada
 * tabel pracetak dan tidak ada cache — dihitung segar tiap muat halaman.
 *
 * Kenapa seluruh antrean diperingkat padahal satu halaman cuma 25 baris:
 * urutannya menurut keyakinan mesin, dan keyakinan baru diketahui setelah
 * kandidatnya dicari. Memeringkat satu halaman saja berarti mengurutkan 25
 * baris yang dipilih acak — bukan 25 teratas.
 */

export type BarisUsulan = {
  kodeAccurate: string
  namaBarang: string
  kategori: string | null
  brand: string | null
  stok: number | null
  kandidat: Kandidat[]
  /** Dua kandidat teratas cocok pada token yang sama persis — lihat §5. */
  kembar: boolean
  keyakinan: Keyakinan
}

export type HasilUsulan = {
  rows: BarisUsulan[]
  total: number
  page: number
  pageCount: number
  perPage: number
  /** Jumlah per tingkat keyakinan di SELURUH antrean, bukan halaman ini. */
  rekap: Record<Keyakinan, number>
}

const PER_PAGE = 25

const URUTAN: Record<Keyakinan, number> = { tinggi: 0, sedang: 1, rendah: 2 }

export async function listUsulanPasangan(opsi: {
  page?: number
  q?: string
}): Promise<HasilUsulan> {
  const prisma = getPrisma()

  /**
   * Katalog pembanding: SELURUH produk web, termasuk yang sudah tertaut ke
   * kode lain. Menyaringnya lebih dulu akan menyembunyikan kandidat yang benar
   * saat sebuah kode terlanjur tertaut ke produk keliru — justru kasus yang
   * paling perlu terlihat. `tautkanKode` yang menolak di ujung, dan
   * penolakannya menyebut produk mana yang memegangnya.
   */
  const [produk, antrean] = await Promise.all([
    prisma.$queryRawUnsafe<{ wooId: number; nama: string }[]>(
      "SELECT woo_id AS wooId, name AS nama FROM products WHERE name IS NOT NULL",
    ),
    prisma.$queryRawUnsafe<
      {
        kode: string
        nama: string
        kategori: string | null
        brand: string | null
        stok: string | null
      }[]
    >(
      `SELECT a.\`Kode Accurate\` AS kode,
              a.\`NAMA BARANG\`   AS nama,
              a.\`KATEGORI\`      AS kategori,
              a.\`NAMA BRAND\`    AS brand,
              a.\`Stok Sistem\`   AS stok
         FROM accurate_products a
         LEFT JOIN products p          ON p.accurate_code = a.\`Kode Accurate\`
         LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
        WHERE p.woo_id IS NULL
          AND ig.kode_accurate IS NULL
          AND (a.\`STATUS\` IS NULL OR a.\`STATUS\` <> 'YA')
          AND a.\`NAMA BARANG\` IS NOT NULL
          AND a.\`NAMA BARANG\` <> ''`,
    ),
  ])

  const katalog = bangunIndeks(produk)

  const cari = opsi.q?.trim().toUpperCase() ?? ""
  const tersaring = cari
    ? antrean.filter(
        (a) => a.nama.toUpperCase().includes(cari) || a.kode.toUpperCase().includes(cari),
      )
    : antrean

  const semua: BarisUsulan[] = tersaring.map((a) => {
    const kandidat = peringkatKandidat(a.nama, katalog, 3)
    return {
      kodeAccurate: a.kode,
      namaBarang: a.nama,
      kategori: a.kategori,
      brand: a.brand,
      stok: a.stok === null || a.stok === "" ? null : Number(a.stok) || 0,
      kandidat,
      kembar: kandidatKembar(kandidat),
      keyakinan: tingkatKeyakinan(kandidat),
    }
  })

  const rekap: Record<Keyakinan, number> = { tinggi: 0, sedang: 0, rendah: 0 }
  for (const b of semua) rekap[b.keyakinan]++

  // Yang paling jelas lebih dulu; di dalam tingkat yang sama, yang paling
  // banyak alasannya. Nama dipakai sebagai pemutus terakhir supaya urutannya
  // TETAP di antara dua muat halaman — tanpa itu, baris bisa berpindah tempat
  // sendiri dan orang kehilangan jejak sampai mana ia bekerja.
  semua.sort((a, b) => {
    const t = URUTAN[a.keyakinan] - URUTAN[b.keyakinan]
    if (t !== 0) return t
    const alasanA = a.kandidat[0]?.alasan.length ?? 0
    const alasanB = b.kandidat[0]?.alasan.length ?? 0
    if (alasanA !== alasanB) return alasanB - alasanA
    return a.namaBarang.localeCompare(b.namaBarang, "id-ID")
  })

  const total = semua.length
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const page = Math.min(Math.max(1, opsi.page ?? 1), pageCount)
  const rows = semua.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return { rows, total, page, pageCount, perPage: PER_PAGE, rekap }
}
