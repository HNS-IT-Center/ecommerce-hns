/**
 * Sisa produk WEB yang belum tertaut ke Accurate, dipecah per kategori web.
 *
 * HANYA MEMBACA. Tidak ada perintah tulis di berkas ini.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/laporan-sisa-tautan-per-kategori-web.mts
 *
 * Beda dengan `laporan-tautan-per-kategori.mts` (sisi Accurate: barang mana yang
 * belum punya produk web), berkas ini sisi WEB: produk TAYANG mana yang belum
 * punya `accurate_code`.
 *
 * Satuan hitung = yang benar-benar bisa ditautkan: SIMPLE dan VARIATION.
 * Induk VARIABLE hanyalah wadah, jadi tidak dihitung (kodenya ada di varian).
 * Kategori VARIATION diambil dari induknya. Kategori yang dipakai adalah
 * kategori UTAMA (is_primary); produk tanpa tanda utama memakai kategori mana
 * pun yang ada. Dikelompokkan ke kategori tingkat teratas (segmen pertama path).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync } from "node:fs"

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const namaDb = new URL(cocok[1]!.replace(/^mysql:/, "http:")).pathname.slice(1)

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

type Baris = {
  induk: string | null
  tayang: bigint
  tertaut: bigint
  belum: bigint
  belumInstock: bigint
}

// Satu kueri untuk seluruh rekap (kuota koneksi Hostinger 500/jam).
const rekap = await prisma.$queryRawUnsafe<Baris[]>(
  `SELECT
     SUBSTRING_INDEX(c.path, ' > ', 1) AS induk,
     COUNT(*) AS tayang,
     SUM(CASE WHEN p.accurate_code IS NOT NULL THEN 1 ELSE 0 END) AS tertaut,
     SUM(CASE WHEN p.accurate_code IS NULL THEN 1 ELSE 0 END) AS belum,
     SUM(CASE WHEN p.accurate_code IS NULL AND p.stock_status = 'INSTOCK' THEN 1 ELSE 0 END) AS belumInstock
   FROM products p
   LEFT JOIN products par ON par.id = p.parent_id
   LEFT JOIN categories c ON c.id = (
     SELECT pc.category_id FROM product_categories pc
     WHERE pc.product_id = COALESCE(par.id, p.id)
     ORDER BY pc.is_primary DESC, pc.category_id
     LIMIT 1
   )
   WHERE p.status = 'PUBLISHED'
     AND p.type IN ('SIMPLE', 'VARIATION')
     AND (par.id IS NULL OR par.status = 'PUBLISHED')
   GROUP BY induk
   ORDER BY belum DESC`,
)

const n = (v: bigint | number) => Number(v).toLocaleString("id-ID")
const pad = (v: bigint | number, l: number) => n(v).padStart(l)

console.log(`\nDatabase : ${namaDb}`)
console.log("Mode     : BACA SAJA")
console.log("Satuan   : produk TAYANG (SIMPLE + VARIATION), induk VARIABLE tidak dihitung\n")
console.log("  KATEGORI (tingkat teratas)                          Tayang  Tertaut    Belum  Belum+instock")
console.log("  " + "-".repeat(96))

let jT = 0, jK = 0, jB = 0, jI = 0
for (const r of rekap) {
  const nama = (r.induk ?? "(tanpa kategori)").slice(0, 46)
  console.log(
    `  ${nama.padEnd(46)} ${pad(r.tayang, 10)}  ${pad(r.tertaut, 7)}  ${pad(r.belum, 7)}  ${pad(r.belumInstock, 13)}`,
  )
  jT += Number(r.tayang); jK += Number(r.tertaut); jB += Number(r.belum); jI += Number(r.belumInstock)
}
console.log("  " + "-".repeat(96))
console.log(`  ${"JUMLAH".padEnd(46)} ${pad(jT, 10)}  ${pad(jK, 7)}  ${pad(jB, 7)}  ${pad(jI, 13)}`)

await prisma.$disconnect()
