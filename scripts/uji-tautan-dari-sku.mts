/**
 * Verifikasi penautan otomatis dari SKU (`tautkanDariSku`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-tautan-dari-sku.mts
 *
 * Menguji FUNGSI SUNGGUHAN, bukan salinan SQL-nya. Menulis entitas buangan
 * "ZZ TEST" ke database LOKAL Docker (`DATABASE_URL` di .env.local, docs/16)
 * dan menghapusnya lagi di `finally`. Kalau `DATABASE_URL` bukan 127.0.0.1 /
 * localhost, skrip berhenti; ia TIDAK pernah jatuh ke produksi.
 *
 * Yang dibuktikan — yang ditautkan DAN yang sengaja tidak:
 *   1. produk biasa ber-SKU kode Accurate ditautkan, tercatat atas nama staff
 *   2. varian ber-SKU kode Accurate ditautkan lewat wooId INDUKNYA
 *   3. induk bervarian, pre-order, kode "tidak dijual", kode nonaktif, dan kode
 *      yang sudah menambat produk lain dilaporkan dengan alasannya
 *   4. SKU yang bukan kode Accurate dilewati tanpa laporan
 *   5. produk yang sudah tertaut tidak disentuh, sekalipun SKU-nya kode lain
 *   6. dijalankan ulang tidak menautkan apa pun lagi dan tidak menambah log
 *   7. `tautkanKode` menolak induk bervarian, tapi melepas kode darinya tetap boleh
 */
import { readFileSync } from "node:fs"

const isiEnv = readFileSync(".env.local", "utf8")
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}

// Database lokal Docker (docs/16), bukan `RESTORE_UJI_DATABASE_URL` — yang itu
// tinggal di server Hostinger dan ikut memakan batas koneksi per jamnya.
const url = process.env.DATABASE_URL ?? ""
const host = url ? new URL(url.replace(/^mysql:/, "http:")).hostname : ""
if (host !== "127.0.0.1" && host !== "localhost") {
  console.error(`DATABASE_URL menunjuk "${host || "(kosong)"}", bukan database lokal — berhenti.`)
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { tautkanDariSku, tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")

const prisma = getPrisma()
const namaDb = new URL(url.replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb} di ${host}  (lokal — bukan produksi)\n`)

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

const OLEH = "ZZ TEST Penaut SKU"
const W = 999910000 // wooId produk uji: W+1 …
const K = (n: number) => `ZZTESTSKU${n}`

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
  // Varian dulu, baru induk — `parent_id` menunjuk induknya.
  await prisma.$executeRawUnsafe("DELETE FROM products WHERE woo_id > ? AND woo_id < ? AND parent_id IS NOT NULL", W, W + 100)
  await prisma.$executeRawUnsafe("DELETE FROM products WHERE woo_id > ? AND woo_id < ?", W, W + 100)
  await prisma.$executeRawUnsafe("DELETE FROM accurate_products WHERE `Kode Accurate` LIKE 'ZZTESTSKU%'")
  await prisma.$executeRawUnsafe("DELETE FROM accurate_items WHERE code LIKE 'ZZTESTSKU%'")
  await prisma.$executeRawUnsafe("DELETE FROM accurate_ignored WHERE kode_accurate LIKE 'ZZTESTSKU%'")
}

async function produk(
  wooId: number,
  nama: string,
  tipe: "SIMPLE" | "VARIABLE" | "VARIATION",
  sku: string | null,
  opsi: { induk?: number; stok?: "INSTOCK" | "ONBACKORDER"; kode?: string } = {},
) {
  const indukId = opsi.induk
    ? (await prisma.product.findUniqueOrThrow({ where: { wooId: opsi.induk }, select: { id: true } })).id
    : null
  await prisma.$executeRawUnsafe(
    `INSERT INTO products (woo_id, name, slug, type, status, sku, stock_status, parent_id, accurate_code)
     VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?)`,
    wooId,
    `ZZ TEST ${nama}`,
    `zz-test-sku-${wooId}`,
    tipe,
    sku,
    opsi.stok ?? "INSTOCK",
    indukId,
    opsi.kode ?? null,
  )
}

async function kodeDi(wooId: number) {
  const r = await prisma.product.findUnique({ where: { wooId }, select: { accurateCode: true } })
  return r?.accurateCode ?? null
}

async function jumlahLog() {
  const r = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM product_logs WHERE `userName` = ? AND action = 'LINK_ACCURATE'",
    OLEH,
  )
  return Number(r[0]?.n ?? 0)
}

try {
  await bersihkan()

  // Barang Accurate. K6 hanya ada di salinan API dan nonaktif; sisanya di Sheet.
  for (const n of [1, 2, 3, 4, 5, 7, 8, 9]) {
    await prisma.$executeRawUnsafe(
      "INSERT INTO accurate_products (`Kode Accurate`, `NAMA BARANG`) VALUES (?, ?)",
      K(n),
      `ZZ TEST Barang ${K(n)}`,
    )
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO accurate_items (id, code, name, type, status, stock_by_warehouse)
     VALUES (?, ?, 'ZZ TEST Barang nonaktif', 'INVENTORY', 'inactive', '[]')`,
    999910006,
    K(6),
  )
  await prisma.$executeRawUnsafe(
    "INSERT INTO accurate_ignored (kode_accurate, alasan, ditandai_oleh) VALUES (?, 'uji', ?)",
    K(5),
    OLEH,
  )

  await produk(W + 1, "Produk biasa", "SIMPLE", K(1))
  await produk(W + 2, "Induk", "VARIABLE", K(2))
  await produk(W + 3, "Varian biasa", "VARIATION", K(3), { induk: W + 2 })
  await produk(W + 4, "Varian pre-order", "VARIATION", K(4), { induk: W + 2, stok: "ONBACKORDER" })
  await produk(W + 5, "Varian kode ditandai", "VARIATION", K(5), { induk: W + 2 })
  await produk(W + 6, "Varian kode nonaktif", "VARIATION", K(6), { induk: W + 2 })
  await produk(W + 7, "Varian kode dipegang lain", "VARIATION", K(7), { induk: W + 2 })
  await produk(W + 8, "Varian SKU pabrikan", "VARIATION", "ZZ-PART-NO-123", { induk: W + 2 })
  await produk(W + 9, "Varian sudah tertaut", "VARIATION", K(9), { induk: W + 2, kode: K(8) })
  await produk(W + 10, "Pemegang kode K7", "SIMPLE", null, { kode: K(7) })

  // --- 1 -----------------------------------------------------------------------
  const h1 = await tautkanDariSku(W + 1, OLEH)
  cek("produk biasa: tanpa galat", h1.galat === undefined, String(h1.galat))
  cek("produk biasa: ditautkan", (await kodeDi(W + 1)) === K(1))
  cek(
    "produk biasa: dilaporkan dengan nama barang Accurate",
    h1.ditautkan.length === 1 && h1.ditautkan[0]?.namaBarang === `ZZ TEST Barang ${K(1)}`,
    JSON.stringify(h1.ditautkan),
  )
  cek("produk biasa: tercatat LINK_ACCURATE atas nama staff", (await jumlahLog()) === 1)

  // --- 2–5: lewat wooId induk --------------------------------------------------
  const h2 = await tautkanDariSku(W + 2, OLEH)
  const alasan = (w: number) => h2.dilewati.find((b) => b.wooId === w)?.alasan ?? ""
  cek("induk: tanpa galat", h2.galat === undefined, String(h2.galat))
  cek("varian biasa: ditautkan lewat wooId induk", (await kodeDi(W + 3)) === K(3))
  cek(
    "hanya varian biasa yang ditautkan",
    h2.ditautkan.map((b) => b.wooId).join(",") === String(W + 3),
    JSON.stringify(h2.ditautkan),
  )
  cek("induk: TIDAK ditautkan", (await kodeDi(W + 2)) === null)
  cek("induk: dilaporkan", alasan(W + 2).startsWith("Induk produk bervarian"), alasan(W + 2))
  cek("pre-order: TIDAK ditautkan", (await kodeDi(W + 4)) === null)
  cek("pre-order: dilaporkan", alasan(W + 4).startsWith("Produk pre-order"), alasan(W + 4))
  cek("kode ditandai: TIDAK ditautkan", (await kodeDi(W + 5)) === null)
  cek("kode ditandai: dilaporkan", alasan(W + 5).includes("tidak dijual di web"), alasan(W + 5))
  cek("kode nonaktif: TIDAK ditautkan", (await kodeDi(W + 6)) === null)
  cek("kode nonaktif: dilaporkan", alasan(W + 6) === "Kode ini nonaktif di Accurate.", alasan(W + 6))
  cek("kode dipegang lain: TIDAK ditautkan", (await kodeDi(W + 7)) === null)
  cek(
    "kode dipegang lain: dilaporkan dengan nama pemegangnya",
    alasan(W + 7).includes("ZZ TEST Pemegang kode K7"),
    alasan(W + 7),
  )
  cek("pemegang kode K7 tetap memegangnya", (await kodeDi(W + 10)) === K(7))
  cek("SKU pabrikan: tidak ditautkan", (await kodeDi(W + 8)) === null)
  cek("SKU pabrikan: TIDAK dilaporkan", alasan(W + 8) === "", alasan(W + 8))
  cek("sudah tertaut: kodenya tetap", (await kodeDi(W + 9)) === K(8))
  cek("sudah tertaut: tidak dilaporkan", alasan(W + 9) === "", alasan(W + 9))
  cek("tepat 5 baris dilaporkan", h2.dilewati.length === 5, String(h2.dilewati.length))
  cek("total log penautan = 2", (await jumlahLog()) === 2, String(await jumlahLog()))

  // --- 6: dijalankan ulang -------------------------------------------------------
  const h3 = await tautkanDariSku(W + 2, OLEH)
  cek("ulang: tidak ada yang ditautkan lagi", h3.ditautkan.length === 0, JSON.stringify(h3.ditautkan))
  cek("ulang: log tidak bertambah", (await jumlahLog()) === 2, String(await jumlahLog()))

  // --- 7: tautkanKode menolak induk bervarian (20 Okt) ----------------------------
  const keInduk = await tautkanKode(W + 2, K(2), OLEH)
  cek(
    "tautkanKode ke induk bervarian ditolak",
    !keInduk.ok && keInduk.alasan.includes("induk bervarian"),
    JSON.stringify(keInduk),
  )
  cek("induk tetap tanpa kode", (await kodeDi(W + 2)) === null)
  cek("penolakan tidak menambah log", (await jumlahLog()) === 2, String(await jumlahLog()))

  // Induk yang TERLANJUR berkode tetap bisa dilepas — itu jalan keluarnya.
  await prisma.$executeRawUnsafe("UPDATE products SET accurate_code = ? WHERE woo_id = ?", K(2), W + 2)
  const lepasInduk = await tautkanKode(W + 2, null, OLEH)
  cek("melepas kode dari induk tetap boleh", lepasInduk.ok && (await kodeDi(W + 2)) === null, JSON.stringify(lepasInduk))

  // --- produk tak ada ------------------------------------------------------------
  const h4 = await tautkanDariSku(W + 99, OLEH)
  cek(
    "wooId tak ada: hasil kosong tanpa galat",
    h4.ditautkan.length === 0 && h4.dilewati.length === 0 && h4.galat === undefined,
    JSON.stringify(h4),
  )
} finally {
  await bersihkan()
  await prisma.$disconnect()
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal > 0 ? 1 : 0)
