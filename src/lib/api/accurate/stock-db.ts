import "server-only"

import { getPrisma } from "@/lib/prisma/client"

/**
 * Akses READ-ONLY ke data Accurate yang kini tinggal DI DALAM `ecommerce_hns`.
 *
 * Latar: data harga/stok Accurate aslinya di database `updatewoo`
 * (stock.hnsitcenter.id) yang diisi dari Accurate. Database itu di server MySQL
 * yang sama tapi remote-access-nya tidak andal (IP dev dinamis), jadi 2 tabel
 * yang kita butuh — `products` dan `product_woo_mapping` — DISALIN ke
 * `ecommerce_hns` dengan nama `accurate_products` dan `accurate_woo_mapping`.
 * Rename supaya tidak bentrok dengan tabel `products` milik Prisma.
 *
 * Konsekuensinya: satu koneksi (`DATABASE_URL` yang sudah ada), jalan di lokal
 * DAN produksi tanpa remote MySQL. Data disegarkan dengan mengimpor ulang 2
 * tabel itu (manual untuk sekarang; sinkron berkala menyusul).
 *
 * Karena `accurate_*` bukan model Prisma (kolomnya berspasi/kapital seperti
 * `Kode Accurate`), dibaca lewat `$queryRawUnsafe`, bukan model. Tetap lewat
 * `getPrisma()` supaya patuh §2.5 (tidak buka koneksi DB sendiri).
 *
 * SATU ARAH: hanya MEMBACA. Penulisan harga terjadi di katalog lewat jalur
 * admin ber-audit-log, bukan di sini. Jangan tambah fungsi tulis ke berkas ini.
 */

/** Ambang "harga mencurigakan": di bawah ini kemungkinan ribuan terpotong. */
const AMBANG_HARGA_RENDAH = 1000

/**
 * Apakah tabel Accurate sudah ada di database. Dipakai halaman untuk memberi
 * pesan "belum ada data" alih-alih melempar kalau impor belum pernah jalan.
 */
export async function isStockDataAvailable(): Promise<boolean> {
  try {
    await getPrisma().$queryRawUnsafe("SELECT 1 FROM accurate_products LIMIT 1")
    return true
  } catch {
    return false
  }
}

/**
 * Hasil membaca satu harga Accurate. `nilai` null berarti tidak ada harga
 * (kosong) — BUKAN nol. `catatan` terisi kalau angkanya mencurigakan, supaya
 * halaman bisa memperingatkan staff tanpa menolak barisnya.
 */
export type HargaAccurate = {
  nilai: number | null
  catatan: string | null
}

/**
 * Baca harga VARCHAR dari Accurate menjadi angka — TANPA mengoreksi.
 *
 * Sengaja tidak "memperbaiki" `145` menjadi `145000`: kita tidak tahu pasti
 * maksudnya, dan menebak harga yang tampil ke pelanggan justru yang dilarang
 * (CLAUDE.md §2.7). Yang mencurigakan diberi `catatan` untuk dilihat manusia.
 */
export function parseHargaAccurate(raw: string | null | undefined): HargaAccurate {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { nilai: null, catatan: null }
  }
  const bersih = raw.replace(/[^\d]/g, "")
  if (bersih === "") return { nilai: null, catatan: `tidak terbaca sebagai angka: "${raw}"` }
  const nilai = Number(bersih)
  if (!Number.isFinite(nilai) || nilai <= 0) {
    return { nilai: null, catatan: `nilai tidak wajar: "${raw}"` }
  }
  if (nilai < AMBANG_HARGA_RENDAH) {
    return { nilai, catatan: `harga sangat rendah (${nilai}) — mungkin ribuan terpotong, cek dulu` }
  }
  return { nilai, catatan: null }
}

/** Satu baris harga Accurate yang sudah dipetakan ke produk web. */
export type BarisHargaAccurate = {
  kodeAccurate: string
  namaBarang: string | null
  wooProductId: number
  hargaSP: HargaAccurate
  hargaPRICE: HargaAccurate
  stokSistem: number | null
  confidence: number
  needsReview: boolean
}

/** Bentuk baris mentah dari query gabungan (kolom di-alias camelCase). */
type RawRow = {
  kodeAccurate: string
  wooProductId: number | bigint
  confidence: number | bigint
  needsReview: number | bigint
  namaBarang: string | null
  sp: string | null
  price: string | null
  stokSistem: string | number | null
}

/**
 * Ambil peta harga Accurate → woo_product_id, HANYA mapping yang layak dipercaya
 * (`needs_review=0` DAN `confidence_score>=90`). Baris dengan mapping ragu
 * sengaja tidak ikut: menaruh harga berdasar tebakan pencocokan bisa memindahkan
 * harga produk A ke produk B.
 */
export async function ambilHargaAccurateTerpetakan(): Promise<BarisHargaAccurate[]> {
  const rows = await getPrisma().$queryRawUnsafe<RawRow[]>(
    `SELECT
       m.kode_accurate      AS kodeAccurate,
       m.woo_product_id     AS wooProductId,
       m.confidence_score   AS confidence,
       m.needs_review       AS needsReview,
       p.\`NAMA BARANG\`     AS namaBarang,
       p.\`SP\`              AS sp,
       p.\`PRICE\`           AS price,
       p.\`Stok Sistem\`     AS stokSistem
     FROM accurate_woo_mapping m
     JOIN accurate_products p ON p.\`Kode Accurate\` = m.kode_accurate
     WHERE m.woo_product_id IS NOT NULL
       AND m.needs_review = 0
       AND m.confidence_score >= 90`,
  )

  return rows.map((r): BarisHargaAccurate => ({
    kodeAccurate: String(r.kodeAccurate),
    namaBarang: r.namaBarang ?? null,
    wooProductId: Number(r.wooProductId),
    hargaSP: parseHargaAccurate(r.sp),
    hargaPRICE: parseHargaAccurate(r.price),
    stokSistem: r.stokSistem === null ? null : Number(r.stokSistem),
    confidence: Number(r.confidence),
    needsReview: Boolean(Number(r.needsReview)),
  }))
}
