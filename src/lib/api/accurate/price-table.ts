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
  /**
   * Produk web yang tertaut lewat `products.accurate_code`, atau null.
   *
   * Permintaan pemilik project (docs/13 §8.2): barang tanpa produk web TIDAK
   * dibuatkan draft — yang dibutuhkan cuma keterangan ada atau belum. Daftar
   * yang belum tertaut sekaligus menjadi antrean kerja penautan.
   */
  produkWeb: { wooId: number; nama: string } | null
}

/**
 * Kolom yang boleh dipakai mengurutkan, beserta ungkapan SQL-nya.
 *
 * DAFTAR TERTUTUP, dan itu bukan kehati-hatian berlebihan: nilainya masuk
 * langsung ke `ORDER BY` yang tidak bisa diparameterkan seperti nilai biasa.
 * Apa pun di luar daftar ini ditolak dan jatuh ke urutan bawaan.
 *
 * Harga di-CAST ke DECIMAL, tidak diurutkan sebagai teks. Kolomnya VARCHAR —
 * warisan ekspor Accurate — dan sebagai teks "900" berada di atas "1000",
 * yang membuat seluruh kolom harga tampak acak justru saat diurutkan.
 */
const KOLOM_URUT = {
  nama: "a.`NAMA BARANG`",
  kode: "a.`Kode Accurate`",
  srp: "CAST(a.`SP` AS DECIMAL(18,0))",
  modal: "CAST(a.`CP` AS DECIMAL(18,0))",
  dealer: "CAST(a.`PRICE` AS DECIMAL(18,0))",
  stok: "a.`Stok Sistem`",
} as const

export type KolomUrut = keyof typeof KOLOM_URUT
export type ArahUrut = "asc" | "desc"

/**
 * Baris yang di layar tampil sebagai "—" harus selalu di BAWAH, arah apa pun.
 *
 * Syaratnya sengaja lebih longgar dari sekadar NULL/kosong: ia ikut menangkap
 * nol dan teks yang tak terbaca sebagai angka (yang di-CAST juga jadi nol).
 * Alasannya kesetaraan dengan tampilan — `parseHargaAccurate` menolak nilai
 * `<= 0` sebagai harga, jadi baris ber-`SP = "0"` sudah tampil "—" beserta
 * catatan "nilai tidak wajar". Kalau pengurutan tidak ikut menganggapnya
 * kosong, mengurutkan menaik menyodorkan sederet "—" di halaman pertama —
 * persis pemandangan yang membuat pengurutan terasa rusak.
 */
const SUMBER_KOSONG: Partial<Record<KolomUrut, string>> = {
  srp: "(a.`SP` IS NULL OR a.`SP` = '' OR CAST(a.`SP` AS DECIMAL(18,0)) <= 0)",
  modal: "(a.`CP` IS NULL OR a.`CP` = '' OR CAST(a.`CP` AS DECIMAL(18,0)) <= 0)",
  dealer: "(a.`PRICE` IS NULL OR a.`PRICE` = '' OR CAST(a.`PRICE` AS DECIMAL(18,0)) <= 0)",
  nama: "(a.`NAMA BARANG` IS NULL OR a.`NAMA BARANG` = '')",
}

export function isKolomUrut(v: string): v is KolomUrut {
  return v in KOLOM_URUT
}

/** Penyaring keterkaitan dengan katalog web. Kosong = semua. */
export type FilterTautan = "tertaut" | "belum"

export type FilterTabelHarga = {
  q?: string
  kategori?: string
  brand?: string
  status?: string
  page?: number
  urut?: KolomUrut
  arah?: ArahUrut
  tautan?: FilterTautan
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
  wooId: number | bigint | null
  namaProdukWeb: string | null
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

  /**
   * Pencocokan per KATA, meniru pencarian storefront
   * (`lib/api/woocommerce/products.ts`) supaya keduanya terasa sama.
   *
   * Mencocokkan seluruh kalimat sebagai satu potongan gagal pada cara orang
   * benar-benar mengetik: "16 GB 512GB RTX5060" tidak pernah cocok dengan
   * barang bernama "...16GB 512GB RTX5060..." karena spasi di "16 GB". Dipecah
   * per kata, "16" cocok di dalam "16GB" dan barangnya ketemu.
   *
   * Antar kata AND, di dalam satu kata OR ke empat kolom — jadi menambah kata
   * selalu MEMPERSEMPIT hasil. Kalau seluruhnya OR, mengetik lebih spesifik
   * justru memunculkan lebih banyak barang.
   *
   * Empat kolom itu padanan dari yang dicari storefront: nama ≈ NAMA BARANG,
   * SKU ≈ Kode Accurate, lalu brand dan kategori. Staff gudang hafal kode,
   * staff toko hafal nama, dan sebagian mengetik "laptop asus" — kata "laptop"
   * hampir tak pernah ada di nama barang, ia ada di kategorinya.
   *
   * Jumlah kata sengaja TIDAK dibatasi: menempelkan nama barang utuh dari
   * Accurate (yang panjangnya belasan kata) justru cara tercepat menemukan satu
   * baris, dan pemotongan diam-diam akan membuat sebagian kata terabaikan tanpa
   * ada yang tahu.
   */
  const kata = filter.q?.trim().split(/\s+/).filter(Boolean) ?? []
  for (const k of kata) {
    syarat.push(
      "(a.`Kode Accurate` LIKE ? OR a.`NAMA BARANG` LIKE ? OR a.`NAMA BRAND` LIKE ? OR a.`KATEGORI` LIKE ?)",
    )
    const pola = `%${k}%`
    params.push(pola, pola, pola, pola)
  }
  if (filter.kategori) {
    syarat.push("a.`KATEGORI` = ?")
    params.push(filter.kategori)
  }
  if (filter.brand) {
    syarat.push("a.`NAMA BRAND` = ?")
    params.push(filter.brand)
  }
  if (filter.status) {
    syarat.push("a.`STATUS` = ?")
    params.push(filter.status)
  }

  /**
   * Penyaring "sudah/belum ada di web". Kolomnya milik `products`, bukan
   * `accurate_products` — sah karena kedua query memakai LEFT JOIN yang sama.
   */
  if (filter.tautan === "tertaut") syarat.push("p.accurate_code IS NOT NULL")
  if (filter.tautan === "belum") syarat.push("p.accurate_code IS NULL")

  return { sql: syarat.length ? `WHERE ${syarat.join(" AND ")}` : "", params }
}

/**
 * Susun `ORDER BY`.
 *
 * Tiga kunci, berurutan:
 *
 * 1. **Yang kosong selalu di bawah**, arah apa pun. Mengurutkan menurut harga
 *    lalu mendapati 4.700 baris tanpa harga menumpuk di halaman pertama membuat
 *    pengurutannya sia-sia — dan membalik arah tidak menolong, ia cuma
 *    memindahkan tumpukan itu ke ujung yang lain.
 * 2. Kolom yang diminta.
 * 3. `Kode Accurate` sebagai pemecah seri. Tanpa kunci kedua yang pasti unik,
 *    baris berharga sama bisa berpindah urutan tiap kali halaman dimuat, dan
 *    barang yang sama muncul dua kali di dua halaman berbeda.
 */
function bangunOrderBy(filter: FilterTabelHarga): string {
  const kolom = filter.urut && isKolomUrut(filter.urut) ? filter.urut : "nama"
  const arah = filter.arah === "desc" ? "DESC" : "ASC"
  const kosong = SUMBER_KOSONG[kolom]
  const bagian = [
    ...(kosong ? [`${kosong} ASC`] : []),
    `${KOLOM_URUT[kolom]} ${arah}`,
    "`Kode Accurate` ASC",
  ]
  return bagian.join(", ")
}

/** Ambil satu halaman tabel harga sesuai filter. */
export async function listHargaAccurate(filter: FilterTabelHarga): Promise<HasilTabelHarga> {
  const prisma = getPrisma()
  const { sql: where, params } = bangunWhere(filter)

  /**
   * Query hitung memakai alias & join yang SAMA PERSIS dengan query isi.
   *
   * Join-nya ikut walau tidak ada kolom `products` yang dihitung, karena
   * penyaring "sudah/belum ada di web" menyentuhnya — dan kalau hanya salah
   * satu query yang punya join, jumlah halaman berhenti cocok dengan isinya.
   * LEFT JOIN pada kolom unik tidak menggandakan baris.
   */
  const totalRows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    `SELECT COUNT(*) AS n
     FROM accurate_products a
     LEFT JOIN products p ON p.accurate_code = a.\`Kode Accurate\`
     ${where}`,
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
       a.\`Kode Accurate\` AS kodeAccurate,
       a.\`NAMA BARANG\`   AS namaBarang,
       a.\`KATEGORI\`      AS kategori,
       a.\`NAMA BRAND\`    AS brand,
       a.\`STATUS\`        AS status,
       a.\`SP\`            AS sp,
       a.\`CP\`            AS cp,
       a.\`PRICE\`         AS price,
       a.\`Stok Sistem\`   AS stok,
       p.woo_id            AS wooId,
       p.name              AS namaProdukWeb
     FROM accurate_products a
     LEFT JOIN products p ON p.accurate_code = a.\`Kode Accurate\`
     ${where}
     ORDER BY ${bangunOrderBy(filter)}
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
      produkWeb:
        r.wooId === null
          ? null
          : { wooId: Number(r.wooId), nama: r.namaProdukWeb ?? "(tanpa nama)" },
    })),
    total,
    page,
    pageCount,
    perPage: PER_PAGE,
  }
}

/** Satu calon produk web di pemilih penautan. */
export type CalonProdukWeb = {
  wooId: number
  nama: string
  sku: string | null
  /** Kode Accurate yang SUDAH menambatnya, kalau ada. */
  sudahTertaut: string | null
}

/**
 * Cari produk web untuk ditautkan.
 *
 * Produk yang SUDAH tertaut tetap ikut muncul, tidak disembunyikan — beserta
 * kode yang menambatnya. Menyembunyikannya membuat orang mencari-cari produk
 * yang jelas ada di katalog lalu menyimpulkan pencariannya rusak; menampilkannya
 * beserta keterangan membuat sebabnya langsung terbaca, dan tombol tautnya
 * yang dimatikan.
 *
 * Pencocokannya per kata seperti tabel harga, dengan alasan yang sama.
 */
export async function cariProdukWeb(q: string, batas = 20): Promise<CalonProdukWeb[]> {
  const kata = q.trim().split(/\s+/).filter(Boolean)
  if (kata.length === 0) return []

  const syarat: string[] = []
  const params: unknown[] = []
  for (const k of kata) {
    syarat.push("(name LIKE ? OR sku LIKE ?)")
    params.push(`%${k}%`, `%${k}%`)
  }

  const rows = await getPrisma().$queryRawUnsafe<
    { wooId: number | bigint; nama: string; sku: string | null; kode: string | null }[]
  >(
    `SELECT woo_id AS wooId, name AS nama, sku, accurate_code AS kode
     FROM products
     WHERE ${syarat.join(" AND ")}
     ORDER BY (accurate_code IS NOT NULL) ASC, name ASC
     LIMIT ?`,
    ...params,
    batas,
  )

  return rows.map((r) => ({
    wooId: Number(r.wooId),
    nama: r.nama,
    sku: r.sku,
    sudahTertaut: r.kode,
  }))
}

export type HasilTaut =
  | { ok: true }
  | { ok: false; alasan: string }

/**
 * Tautkan satu kode Accurate ke satu produk web — atau lepaskan (`kode: null`).
 *
 * Menolak, bukan menimpa, kalau kodenya sudah menambat produk lain. Kolomnya
 * unik, jadi menimpa berarti memutus tautan produk lain diam-diam — dan orang
 * yang menautkan tidak akan tahu ia baru saja melepas sesuatu.
 */
export async function tautkanKode(wooId: number, kode: string | null): Promise<HasilTaut> {
  const prisma = getPrisma()

  if (kode !== null) {
    const ada = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      "SELECT COUNT(*) AS n FROM accurate_products WHERE `Kode Accurate` = ?",
      kode,
    )
    if (Number(ada[0]?.n ?? 0) === 0) {
      return { ok: false, alasan: "Kode Accurate tidak ditemukan." }
    }

    const dipakai = await prisma.$queryRawUnsafe<{ nama: string; wooId: number | bigint }[]>(
      "SELECT name AS nama, woo_id AS wooId FROM products WHERE accurate_code = ? AND woo_id <> ?",
      kode,
      wooId,
    )
    if (dipakai.length > 0) {
      return {
        ok: false,
        alasan: `Kode ini sudah menambat produk lain: ${dipakai[0]!.nama}. Lepaskan dari sana dulu.`,
      }
    }
  }

  const terpengaruh = await prisma.$executeRawUnsafe(
    "UPDATE products SET accurate_code = ? WHERE woo_id = ?",
    kode,
    wooId,
  )
  if (terpengaruh === 0) return { ok: false, alasan: "Produk web tidak ditemukan." }
  return { ok: true }
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
  opsi: { bolehUbahModal: boolean },
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

    /**
     * Tanpa izin harga modal, kolom `CP` TIDAK ikut dalam perintah UPDATE —
     * bukan sekadar tidak ditampilkan.
     *
     * Kolomnya memang disembunyikan di layar, tapi menyembunyikan sesuatu hanya
     * menyembunyikannya: server action adalah alamat HTTP tersendiri dan bisa
     * dipanggil dengan muatan yang disusun sendiri. Yang benar-benar menahan
     * adalah perintah SQL yang tidak pernah menyebut kolom itu.
     */
    const terpengaruh = opsi.bolehUbahModal
      ? await prisma.$executeRawUnsafe(
          "UPDATE accurate_products SET `CP` = ?, `PRICE` = ? WHERE `Kode Accurate` = ?",
          p.modal === null ? "" : String(p.modal),
          p.dealer === null ? "" : String(p.dealer),
          p.kodeAccurate,
        )
      : await prisma.$executeRawUnsafe(
          "UPDATE accurate_products SET `PRICE` = ? WHERE `Kode Accurate` = ?",
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
