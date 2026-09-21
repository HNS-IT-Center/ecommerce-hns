/**
 * Verifikasi `abaikanKodeMassal` & `batalkanAbaikanMassal`.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-abaikan-massal.mts
 *
 * Menguji FUNGSI SUNGGUHAN, bukan salinan SQL-nya. Menulis entitas buangan
 * berawalan "ZZ TEST" ke database UJI (`RESTORE_UJI_DATABASE_URL`), lalu
 * menghapusnya lagi di blok `finally` — termasuk kalau ada uji yang gagal di
 * tengah. Kalau env itu tidak ada, skrip berhenti; ia TIDAK pernah jatuh ke
 * produksi.
 *
 * Yang dibuktikan:
 *   1. kode sah ditandai, dan benar-benar masuk `accurate_ignored`
 *   2. kode yang MASIH TERTAUT ke produk web dilewati, bukan ditandai
 *   3. kode ngawur dilewati dengan sebabnya sendiri
 *   4. menandai ulang tidak melempar galat kunci ganda
 *   5. duplikat dalam satu permintaan tidak menggandakan baris
 *   6. pembatalan massal menghapus, dan yang tak bertanda dilaporkan dilewati
 *   7. permintaan melebihi BATAS_MASSAL ditolak utuh — bukan dipotong diam-diam
 */
import { readFileSync } from "node:fs"

const isiEnv = readFileSync(".env.local", "utf8")
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}

const uji = process.env.RESTORE_UJI_DATABASE_URL
if (!uji) {
  console.error("RESTORE_UJI_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).")
  process.exit(1)
}
process.env.DATABASE_URL = uji

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { abaikanKodeMassal, batalkanAbaikanMassal, BATAS_MASSAL } = await import(
  "../src/lib/api/accurate/price-table.ts"
)

const prisma = getPrisma()
const namaDb = new URL(uji.replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb}  (uji — bukan produksi)\n`)

let lulus = 0
let gagal = 0
function cek(nama: string, benar: boolean, detail = "") {
  if (benar) {
    lulus++
    console.log(`  OK    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${detail ? ` — ${detail}` : ""}`)
  }
}

/**
 * Database uji ini restore lama — sebagian tabel yang dipakai fitur Accurate
 * belum ada di sana. Dibuat di sini kalau belum ada, supaya skripnya bisa jalan
 * sendiri tanpa langkah manual yang mudah terlupa.
 *
 * Berpagar nama database: kalau namanya tidak mengandung "uji", skrip berhenti
 * sebelum satu pun DDL dijalankan. DDL tidak bisa dibatalkan, dan salah sasaran
 * di sini berarti membuat tabel di produksi.
 */
if (!namaDb.includes("uji")) {
  console.error(`Nama database "${namaDb}" tidak mengandung "uji" — berhenti.`)
  process.exit(1)
}

await prisma.$executeRawUnsafe(
  `CREATE TABLE IF NOT EXISTS \`accurate_ignored\` (
     \`kode_accurate\` VARCHAR(50) NOT NULL,
     \`alasan\` VARCHAR(255) NULL,
     \`ditandai_oleh\` VARCHAR(191) NOT NULL,
     \`ditandai_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
     PRIMARY KEY (\`kode_accurate\`)
   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
)
await prisma.$executeRawUnsafe(
  `CREATE TABLE IF NOT EXISTS \`accurate_products\` (
     \`Kode Accurate\` VARCHAR(50) NOT NULL,
     \`NAMA BARANG\` VARCHAR(500) NULL,
     \`SP\` VARCHAR(50) NULL,
     \`CP\` VARCHAR(50) NULL,
     \`PRICE\` VARCHAR(50) NULL,
     \`STATUS\` VARCHAR(20) NULL,
     \`Stok Sistem\` VARCHAR(50) NULL,
     PRIMARY KEY (\`Kode Accurate\`)
   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
)

const KODE_BEBAS = "ZZTESTMASSAL1"
const KODE_BEBAS2 = "ZZTESTMASSAL2"
const KODE_TERTAUT = "ZZTESTMASSAL3"
const KODE_NGAWUR = "ZZTESTMASSAL-TIDAK-ADA"
const WOO_ID_UJI = 999900001

async function bersihkan() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM accurate_ignored WHERE kode_accurate LIKE 'ZZTESTMASSAL%'",
  )
  await prisma.$executeRawUnsafe("DELETE FROM products WHERE woo_id = ?", WOO_ID_UJI)
  await prisma.$executeRawUnsafe(
    "DELETE FROM accurate_products WHERE `Kode Accurate` LIKE 'ZZTESTMASSAL%'",
  )
}

async function jumlahDitandai(kode: string) {
  const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM accurate_ignored WHERE kode_accurate = ?",
    kode,
  )
  return Number(r[0]?.n ?? 0)
}

try {
  await bersihkan()

  for (const kode of [KODE_BEBAS, KODE_BEBAS2, KODE_TERTAUT]) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO accurate_products (`Kode Accurate`, `NAMA BARANG`) VALUES (?, ?)",
      kode,
      `ZZ TEST Barang ${kode}`,
    )
  }

  // Produk web yang menambat KODE_TERTAUT — kasus yang harus dilewati.
  await prisma.$executeRawUnsafe(
    `INSERT INTO products (woo_id, name, slug, type, status, accurate_code)
     VALUES (?, 'ZZ TEST Produk Tertaut', ?, 'SIMPLE', 'DRAFT', ?)`,
    WOO_ID_UJI,
    `zz-test-produk-tertaut-${WOO_ID_UJI}`,
    KODE_TERTAUT,
  )

  // --- 1, 2, 3 sekaligus: satu permintaan bercampur --------------------------
  const hasil = await abaikanKodeMassal(
    [KODE_BEBAS, KODE_BEBAS2, KODE_TERTAUT, KODE_NGAWUR],
    "ZZ TEST",
  )
  cek(
    "kode bebas ditandai",
    hasil.berhasil.includes(KODE_BEBAS) && hasil.berhasil.includes(KODE_BEBAS2),
    JSON.stringify(hasil.berhasil),
  )
  cek("tertulis ke accurate_ignored", (await jumlahDitandai(KODE_BEBAS)) === 1)
  cek(
    "kode yang masih tertaut DILEWATI",
    !hasil.berhasil.includes(KODE_TERTAUT) &&
      hasil.dilewati.some((d) => d.kode === KODE_TERTAUT && d.alasan.includes("Masih tertaut")),
    JSON.stringify(hasil.dilewati),
  )
  cek("kode tertaut tidak tertulis", (await jumlahDitandai(KODE_TERTAUT)) === 0)
  cek(
    "kode ngawur dilewati dengan sebabnya",
    hasil.dilewati.some((d) => d.kode === KODE_NGAWUR && d.alasan.includes("tidak ditemukan")),
    JSON.stringify(hasil.dilewati),
  )

  // --- 4: menandai ulang -----------------------------------------------------
  const ulang = await abaikanKodeMassal([KODE_BEBAS], "ZZ TEST ULANG")
  cek("menandai ulang tidak melempar", ulang.berhasil.includes(KODE_BEBAS))
  cek("tidak menggandakan baris", (await jumlahDitandai(KODE_BEBAS)) === 1)

  // --- 5: duplikat dalam satu permintaan -------------------------------------
  await prisma.$executeRawUnsafe("DELETE FROM accurate_ignored WHERE kode_accurate = ?", KODE_BEBAS)
  const kembar = await abaikanKodeMassal([KODE_BEBAS, KODE_BEBAS, KODE_BEBAS], "ZZ TEST")
  cek("duplikat dipangkas jadi satu", kembar.berhasil.length === 1, JSON.stringify(kembar.berhasil))
  cek("hanya satu baris tertulis", (await jumlahDitandai(KODE_BEBAS)) === 1)

  // --- 6: pembatalan massal --------------------------------------------------
  const batal = await batalkanAbaikanMassal([KODE_BEBAS, KODE_BEBAS2, KODE_TERTAUT])
  cek(
    "yang bertanda dihapus",
    batal.berhasil.includes(KODE_BEBAS) && batal.berhasil.includes(KODE_BEBAS2),
    JSON.stringify(batal.berhasil),
  )
  cek("benar-benar hilang dari tabel", (await jumlahDitandai(KODE_BEBAS)) === 0)
  cek(
    "yang tak bertanda dilaporkan dilewati",
    batal.dilewati.some((d) => d.kode === KODE_TERTAUT && d.alasan.includes("Tidak sedang ditandai")),
    JSON.stringify(batal.dilewati),
  )

  // --- 7: batas jumlah -------------------------------------------------------
  const kebanyakan = Array.from({ length: BATAS_MASSAL + 1 }, (_, i) => `ZZTESTMASSAL-X${i}`)
  const ditolak = await abaikanKodeMassal(kebanyakan, "ZZ TEST")
  cek(
    "melebihi batas ditolak UTUH, bukan dipotong",
    ditolak.berhasil.length === 0 && ditolak.dilewati.length === kebanyakan.length,
    `berhasil=${ditolak.berhasil.length} dilewati=${ditolak.dilewati.length}`,
  )

  console.log(`\n${lulus} lulus, ${gagal} gagal`)
} finally {
  await bersihkan()
  await prisma.$disconnect()
}

process.exit(gagal > 0 ? 1 : 0)
