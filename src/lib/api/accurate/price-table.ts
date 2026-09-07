import "server-only"

import { getPrisma } from "@/lib/prisma/client"
import { parseHargaAccurate, type HargaAccurate } from "./stock-db"

/**
 * Tabel harga internal Accurate — baca DAN tulis.
 *
 * Berkas terpisah dari `stock-db.ts` dengan sengaja: berkas itu menyatakan
 * dirinya satu arah ("jangan tambah fungsi tulis ke berkas ini") karena ia
 * memasok harga yang berakhir di katalog pelanggan. Yang di sini beda urusannya
 * — ia menyunting kolom INTERNAL (modal & dealer) di `accurate_products`, dan
 * tidak satu pun dari keduanya pernah tampil ke pembeli.
 *
 * Pemetaan kolom ↔ istilah yang dipakai staff (dipastikan dari data produksi,
 * bukan dari nama kolomnya: CP 41.441 < PRICE 50.000 < SP 55.000, dan SP > PRICE
 * di 2.132 dari 2.306 baris berharga):
 *
 *   `SP`    → **SRP**    harga jual ke pelanggan   — hanya DIBACA di sini
 *   `CP`    → **Modal**  harga kita membeli barang — internal, boleh disunting
 *   `PRICE` → **Dealer** harga untuk pembeli B2B   — internal, boleh disunting
 *
 * SRP tidak bisa disunting lewat berkas ini. Ia harga yang dilihat pelanggan,
 * dan CLAUDE.md §2.7 menempatkannya di jalur katalog ber-audit-log, bukan di
 * tabel kerja seperti ini.
 *
 * `accurate_*` bukan model Prisma (kolomnya berspasi & kapital seperti
 * `Kode Accurate`), jadi lewat raw query — tetap dari `getPrisma()` supaya tidak
 * membuka koneksi sendiri (§2.5). Semua nilai dikirim sebagai parameter `?`,
 * tidak pernah dijahit ke dalam string SQL.
 */

/** Baris untuk tabel harga. Harga tetap mentah + catatan, tidak "diperbaiki". */
export type BarisTabelHarga = {
  kodeAccurate: string
  namaBarang: string | null
  kategori: string | null
  brand: string | null
  status: string | null
  /** Harga jual ke pelanggan (kolom `SP`). Read-only di halaman ini. */
  srp: HargaAccurate
  /** Harga modal (kolom `CP`). Internal. */
  modal: HargaAccurate
  /** Harga dealer/B2B (kolom `PRICE`). Internal. */
  dealer: HargaAccurate
  stok: number | null
}

export type FilterTabelHarga = {
  q?: string
  kategori?: string
  brand?: string
  status?: string
  page?: number
}

export type HasilTabelHarga = {
  rows: BarisTabelHarga[]
  total: number
  page: number
  pageCount: number
  perPage: number
}

/**
 * 50 baris per halaman — angka yang sama dengan aplikasi lama yang jadi acuan
 * (7.041 barang → 141 halaman). Bukan sekadar meniru: seluruh isi tabel ini
 * ditarik dari satu tabel tanpa join, dan 50 baris sudah cukup panjang untuk
 * digulir sekali tanpa membuat query per halaman terasa berat.
 */
const PER_PAGE = 50

type RawRow = {
  kodeAccurate: string
  namaBarang: string | null
  kategori: string | null
  brand: string | null
  status: string | null
  sp: string | null
  cp: string | null
  price: string | null
  stok: string | number | null
}

/**
 * Susun potongan `WHERE` beserta parameternya.
 *
 * Dikembalikan berpasangan supaya query isi dan query hitung memakai syarat yang
 * SAMA PERSIS. Kalau keduanya menyusun WHERE sendiri-sendiri, cepat atau lambat
 * salah satunya ketinggalan diubah dan jumlah halaman tidak lagi cocok dengan
 * isinya — kesalahan yang tidak terlihat sampai seseorang membuka halaman
 * terakhir dan menemukannya kosong.
 */
function bangunWhere(filter: FilterTabelHarga): { sql: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  const q = filter.q?.trim()
  if (q) {
    // Dicari di kode DAN nama: staff gudang hafal kode, staff toko hafal nama.
    syarat.push("(`Kode Accurate` LIKE ? OR `NAMA BARANG` LIKE ?)")
    params.push(`%${q}%`, `%${q}%`)
  }
  if (filter.kategori) {
    syarat.push("`KATEGORI` = ?")
    params.push(filter.kategori)
  }
  if (filter.brand) {
    syarat.push("`NAMA BRAND` = ?")
    params.push(filter.brand)
  }
  if (filter.status) {
    syarat.push("`STATUS` = ?")
    params.push(filter.status)
  }

  return { sql: syarat.length ? `WHERE ${syarat.join(" AND ")}` : "", params }
}

/** Ambil satu halaman tabel harga sesuai filter. */
export async function listHargaAccurate(filter: FilterTabelHarga): Promise<HasilTabelHarga> {
  const prisma = getPrisma()
  const { sql: where, params } = bangunWhere(filter)

  const totalRows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n FROM accurate_products ${where}`,
    ...params,
  )
  const total = Number(totalRows[0]?.n ?? 0)
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  // Halaman di luar jangkauan dijepit, bukan ditolak — tautan lama atau
  // penyaringan yang mempersempit hasil tidak seharusnya berakhir di layar
  // kosong tanpa keterangan.
  const page = Math.min(Math.max(1, filter.page ?? 1), pageCount)

  const rows = await prisma.$queryRawUnsafe<RawRow[]>(
    `SELECT
       \`Kode Accurate\` AS kodeAccurate,
       \`NAMA BARANG\`   AS namaBarang,
       \`KATEGORI\`      AS kategori,
       \`NAMA BRAND\`    AS brand,
       \`STATUS\`        AS status,
       \`SP\`            AS sp,
       \`CP\`            AS cp,
       \`PRICE\`         AS price,
       \`Stok Sistem\`   AS stok
     FROM accurate_products
     ${where}
     ORDER BY \`NAMA BARANG\` IS NULL, \`NAMA BARANG\` ASC
     LIMIT ? OFFSET ?`,
    ...params,
    PER_PAGE,
    (page - 1) * PER_PAGE,
  )

  return {
    rows: rows.map((r): BarisTabelHarga => ({
      kodeAccurate: String(r.kodeAccurate),
      namaBarang: r.namaBarang,
      kategori: r.kategori,
      brand: r.brand,
      status: r.status,
      srp: parseHargaAccurate(r.sp),
      modal: parseHargaAccurate(r.cp),
      dealer: parseHargaAccurate(r.price),
      stok: r.stok === null ? null : Number(r.stok),
    })),
    total,
    page,
    pageCount,
    perPage: PER_PAGE,
  }
}

export type OpsiFilter = {
  kategori: string[]
  brand: string[]
  status: string[]
}

/**
 * Nilai yang tersedia untuk ketiga penyaring, dibaca dari data yang ada.
 *
 * Bukan daftar tetap di dalam kode: kategori & brand lahir dari ekspor Accurate
 * dan bertambah tiap ada barang jenis baru. Daftar yang ditulis tangan akan
 * diam-diam menyembunyikan barang yang kategorinya belum sempat didaftarkan.
 */
export async function ambilOpsiFilter(): Promise<OpsiFilter> {
  const prisma = getPrisma()
  const [kategori, brand, status] = await Promise.all([
    prisma.$queryRawUnsafe<{ v: string | null }[]>(
      "SELECT DISTINCT `KATEGORI` AS v FROM accurate_products WHERE `KATEGORI` IS NOT NULL AND `KATEGORI` <> '' ORDER BY v",
    ),
    prisma.$queryRawUnsafe<{ v: string | null }[]>(
      "SELECT DISTINCT `NAMA BRAND` AS v FROM accurate_products WHERE `NAMA BRAND` IS NOT NULL AND `NAMA BRAND` <> '' ORDER BY v",
    ),
    prisma.$queryRawUnsafe<{ v: string | null }[]>(
      "SELECT DISTINCT `STATUS` AS v FROM accurate_products WHERE `STATUS` IS NOT NULL AND `STATUS` <> '' ORDER BY v",
    ),
  ])
  const bersih = (rows: { v: string | null }[]) =>
    rows.map((r) => r.v).filter((v): v is string => typeof v === "string" && v !== "")

  return { kategori: bersih(kategori), brand: bersih(brand), status: bersih(status) }
}

/** Satu perubahan harga internal. `null` berarti kosongkan kolomnya. */
export type PerubahanHarga = {
  kodeAccurate: string
  modal: number | null
  dealer: number | null
}

export type HasilSimpan = {
  tersimpan: number
  gagal: { kodeAccurate: string; alasan: string }[]
}

/**
 * Simpan harga modal & dealer.
 *
 * HANYA dua kolom itu. `SP` (harga yang dilihat pelanggan) tidak ikut, dan
 * sengaja tidak disediakan jalannya di sini — §2.7.
 *
 * Nilainya ditulis sebagai angka polos tanpa pemisah ribuan, cocok dengan
 * bentuk yang sudah ada di tabel (kolomnya VARCHAR, warisan ekspor Accurate),
 * supaya `parseHargaAccurate` membacanya sama seperti baris hasil impor.
 */
export async function simpanHargaInternal(
  perubahan: PerubahanHarga[],
): Promise<HasilSimpan> {
  const prisma = getPrisma()
  const gagal: HasilSimpan["gagal"] = []
  let tersimpan = 0

  for (const p of perubahan) {
    const salah = validasiHarga(p)
    if (salah) {
      gagal.push({ kodeAccurate: p.kodeAccurate, alasan: salah })
      continue
    }
    const terpengaruh = await prisma.$executeRawUnsafe(
      "UPDATE accurate_products SET `CP` = ?, `PRICE` = ? WHERE `Kode Accurate` = ?",
      p.modal === null ? "" : String(p.modal),
      p.dealer === null ? "" : String(p.dealer),
      p.kodeAccurate,
    )
    if (terpengaruh === 0) {
      gagal.push({ kodeAccurate: p.kodeAccurate, alasan: "kode tidak ditemukan" })
      continue
    }
    tersimpan += 1
  }

  return { tersimpan, gagal }
}

/**
 * Tolak angka yang mustahil, TAPI jangan tolak yang cuma tidak biasa.
 *
 * Harga sangat rendah (mis. 145 untuk barang ratusan ribu) dibiarkan lewat dan
 * ditandai di layar sebagai catatan, bukan dihalangi — persis sikap
 * `parseHargaAccurate`. Data Accurate memang memuat baris seperti itu, dan
 * staff yang sedang membetulkannya justru perlu bisa mengetik ulang angkanya.
 */
function validasiHarga(p: PerubahanHarga): string | null {
  for (const [nama, nilai] of [["modal", p.modal], ["dealer", p.dealer]] as const) {
    if (nilai === null) continue
    if (!Number.isFinite(nilai)) return `harga ${nama} bukan angka`
    if (nilai < 0) return `harga ${nama} tidak boleh negatif`
    if (!Number.isInteger(nilai)) return `harga ${nama} harus bilangan bulat (rupiah)`
  }
  return null
}
