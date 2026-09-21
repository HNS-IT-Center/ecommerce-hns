/**
 * Verifikasi jejak audit penautan Accurate.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-jejak-penautan.mts
 *
 * Menguji FUNGSI SUNGGUHAN `tautkanKode`, bukan salinan SQL-nya. Menulis
 * entitas buangan "ZZ TEST" ke database UJI (`RESTORE_UJI_DATABASE_URL`) dan
 * menghapusnya lagi di `finally`. Kalau env itu tidak ada, skrip berhenti; ia
 * TIDAK pernah jatuh ke produksi.
 *
 * Yang dibuktikan — dua sisi, karena log yang terlalu rajin sama menyesatkannya
 * dengan log yang tidak ada:
 *   1. menautkan mencatat LINK_ACCURATE beserta kode lama & baru
 *   2. productId yang dicatat adalah wooId, bukan Product.id internal
 *   3. menautkan ulang ke kode YANG SAMA tidak menambah baris log
 *   4. mengganti kode mencatat perpindahannya (lama -> baru)
 *   5. melepas tautan mencatat UNLINK_ACCURATE
 *   6. penautan yang GAGAL tidak meninggalkan jejak sama sekali
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
const { tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")

const prisma = getPrisma()
const namaDb = new URL(uji.replace(/^mysql:/, "http:")).pathname.slice(1)
if (!namaDb.includes("uji")) {
  console.error(`Nama database "${namaDb}" tidak mengandung "uji" — berhenti.`)
  process.exit(1)
}
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

const KODE_A = "ZZTESTTAUT1"
const KODE_B = "ZZTESTTAUT2"
const WOO_ID = 999900002
const OLEH = "ZZ TEST Petugas"

await prisma.$executeRawUnsafe(
  `CREATE TABLE IF NOT EXISTS \`accurate_products\` (
     \`Kode Accurate\` VARCHAR(50) NOT NULL,
     \`NAMA BARANG\` VARCHAR(500) NULL,
     \`SP\` VARCHAR(50) NULL, \`CP\` VARCHAR(50) NULL, \`PRICE\` VARCHAR(50) NULL,
     \`STATUS\` VARCHAR(20) NULL, \`Stok Sistem\` VARCHAR(50) NULL,
     PRIMARY KEY (\`Kode Accurate\`)
   ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
)

async function bersihkan() {
  await prisma.$executeRawUnsafe("DELETE FROM product_logs WHERE `userName` = ?", OLEH)
  await prisma.$executeRawUnsafe("DELETE FROM products WHERE woo_id = ?", WOO_ID)
  await prisma.$executeRawUnsafe(
    "DELETE FROM accurate_products WHERE `Kode Accurate` LIKE 'ZZTESTTAUT%'",
  )
}

/** Baris log penautan untuk produk uji, terbaru dulu. */
async function logPenautan() {
  return prisma.$queryRawUnsafe<
    { action: string; old_value: string | null; new_value: string | null; product_id: number; userName: string; field_affected: string }[]
  >(
    `SELECT action, old_value, new_value, product_id, \`userName\`, field_affected
       FROM product_logs
      WHERE \`userName\` = ? AND action IN ('LINK_ACCURATE','UNLINK_ACCURATE')
      ORDER BY id DESC`,
    OLEH,
  )
}

try {
  await bersihkan()

  for (const kode of [KODE_A, KODE_B]) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO accurate_products (`Kode Accurate`, `NAMA BARANG`) VALUES (?, ?)",
      kode,
      `ZZ TEST Barang ${kode}`,
    )
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO products (woo_id, name, slug, type, status)
     VALUES (?, 'ZZ TEST Produk Jejak', ?, 'SIMPLE', 'DRAFT')`,
    WOO_ID,
    `zz-test-produk-jejak-${WOO_ID}`,
  )

  // --- 1 & 2 -----------------------------------------------------------------
  const h1 = await tautkanKode(WOO_ID, KODE_A, OLEH)
  cek("penautan berhasil", h1.ok, JSON.stringify(h1))
  let log = await logPenautan()
  cek("satu baris log tertulis", log.length === 1, `${log.length} baris`)
  cek(
    "LINK_ACCURATE dengan kode lama kosong -> kode baru",
    log[0]?.action === "LINK_ACCURATE" && log[0]?.old_value === null && log[0]?.new_value === KODE_A,
    JSON.stringify(log[0]),
  )
  cek("productId yang dicatat = wooId", Number(log[0]?.product_id) === WOO_ID, String(log[0]?.product_id))
  cek("pelakunya tercatat", log[0]?.userName === OLEH, String(log[0]?.userName))
  cek("kolom yang berubah disebut", log[0]?.field_affected === "accurate_code", String(log[0]?.field_affected))

  // --- 3: menautkan ulang ke kode yang sama ----------------------------------
  await tautkanKode(WOO_ID, KODE_A, OLEH)
  log = await logPenautan()
  cek("menautkan ulang kode yang SAMA tidak menambah log", log.length === 1, `${log.length} baris`)

  // --- 4: pindah kode --------------------------------------------------------
  await tautkanKode(WOO_ID, KODE_B, OLEH)
  log = await logPenautan()
  cek(
    "pindah kode tercatat lama -> baru",
    log.length === 2 && log[0]?.old_value === KODE_A && log[0]?.new_value === KODE_B,
    JSON.stringify(log[0]),
  )

  // --- 5: lepas tautan -------------------------------------------------------
  await tautkanKode(WOO_ID, null, OLEH)
  log = await logPenautan()
  cek(
    "lepas tautan tercatat UNLINK_ACCURATE",
    log.length === 3 && log[0]?.action === "UNLINK_ACCURATE" && log[0]?.new_value === null,
    JSON.stringify(log[0]),
  )

  // --- 6: penautan yang gagal tidak meninggalkan jejak -----------------------
  const gagalTaut = await tautkanKode(WOO_ID, "ZZTESTTAUT-TIDAK-ADA", OLEH)
  log = await logPenautan()
  cek("penautan gagal ditolak", !gagalTaut.ok, JSON.stringify(gagalTaut))
  cek("penautan gagal TIDAK menulis log", log.length === 3, `${log.length} baris`)

  console.log(`\n${lulus} lulus, ${gagal} gagal`)
} finally {
  await bersihkan()
  await prisma.$disconnect()
}

process.exit(gagal > 0 ? 1 : 0)
