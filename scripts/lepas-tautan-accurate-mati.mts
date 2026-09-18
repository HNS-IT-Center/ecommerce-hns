/**
 * Melepas tautan `products.accurate_code` yang sudah tidak ada gunanya.
 *
 * Dua sebab, keduanya keputusan yang sudah terjadi di luar aplikasi ini:
 *
 *  1. **Barang Accurate-nya tidak aktif** (`STATUS = 'YA'`). Barang yang
 *     dihentikan di kasir tidak akan pernah mengirim harga lagi; tautannya
 *     hanya menyisakan kesan bahwa produk itu masih tersambung.
 *  2. **Produk webnya sudah ditutup** (`status <> 'PUBLISHED'` — di katalog ini
 *     hampir seluruhnya `PRIVATE`). Produk yang tidak dijual lagi tidak perlu
 *     menahan kode Accurate, apalagi kolomnya UNIK: kode yang tertahan di
 *     produk mati tidak bisa dipakai produk penggantinya.
 *
 * Yang SEHAT tidak disentuh — Accurate aktif dan produk web terbit tetap
 * tertaut apa adanya.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/lepas-tautan-accurate-mati.mts
 *
 *   # benar-benar melepas
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/lepas-tautan-accurate-mati.mts --tulis
 *
 * Bawaannya uji kering: yang paling mudah diketik adalah yang paling tidak
 * berbahaya. Sebelum menulis, skrip ini SELALU menyimpan berkas pemulihan di
 * `backup/` berisi perintah UPDATE untuk mengembalikan persis baris-baris yang
 * dilepas — tanpa menyentuh tautan lain.
 *
 * Aman diulang: baris yang sudah dilepas tidak lagi memenuhi syarat.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const namaDb = new URL(cocok[1]!.replace(/^mysql:/, "http:")).pathname.slice(1)

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)
const hitung = async (s: string) => Number((await q<{ n: bigint }>(s))[0]!.n)

console.log(`\nDatabase : ${namaDb}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

const JOIN = "FROM products p JOIN accurate_products a ON a.`Kode Accurate` = p.accurate_code"
const SYARAT = "p.accurate_code IS NOT NULL AND (a.`STATUS` = 'YA' OR p.status <> 'PUBLISHED')"

const total = await hitung("SELECT COUNT(*) AS n FROM products WHERE accurate_code IS NOT NULL")
const accMati = await hitung(`SELECT COUNT(*) AS n ${JOIN} WHERE p.accurate_code IS NOT NULL AND a.\`STATUS\` = 'YA'`)
const webTutup = await hitung(`SELECT COUNT(*) AS n ${JOIN} WHERE p.accurate_code IS NOT NULL AND p.status <> 'PUBLISHED'`)

type Baris = { woo: number | bigint; kode: string; nama: string; st: string; acc: string }
const target = await q<Baris>(
  `SELECT p.woo_id AS woo, p.accurate_code AS kode, p.name AS nama, p.status AS st, a.\`STATUS\` AS acc
   ${JOIN} WHERE ${SYARAT} ORDER BY p.woo_id`,
)

console.log("=== Keadaan sekarang ===")
console.log(`  total tertaut          : ${total}`)
console.log(`  barang Accurate mati   : ${accMati}`)
console.log(`  produk web ditutup     : ${webTutup}`)
console.log(`  (sebagian kena dua-duanya)`)
console.log(`\n  AKAN DILEPAS           : ${target.length}`)
console.log(`  TETAP TERTAUT          : ${total - target.length}`)

console.log("\n=== Contoh 8 yang akan dilepas ===")
for (const r of target.slice(0, 8)) {
  const sebab = [r.acc === "YA" ? "Accurate mati" : null, r.st !== "PUBLISHED" ? `web ${r.st}` : null]
    .filter(Boolean)
    .join(" + ")
  console.log(`  ${r.kode.padEnd(12)} ${sebab.padEnd(28)} ${r.nama.replace(/\r?\n/g, " ").slice(0, 44)}`)
}

if (target.length === 0) {
  console.log("\nTidak ada yang perlu dilepas.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar melepas.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/accurate-dilepas-${stamp}.sql`
writeFileSync(
  berkas,
  `-- ${target.length} tautan accurate_code dilepas pada ${stamp}\n` +
    `-- Sebab: barang Accurate tidak aktif (STATUS=YA) ATAU produk web tidak publish.\n` +
    `-- Jalankan seluruh berkas ini untuk mengembalikan HANYA baris-baris tersebut;\n` +
    `-- tautan lain tidak ikut tersentuh.\n\n` +
    target
      .map((r) => {
        const ket = `web=${r.st} accMati=${r.acc === "YA" ? "ya" : "-"} ${r.nama.replace(/\r?\n/g, " ").slice(0, 50)}`
        return `UPDATE products SET accurate_code = '${r.kode.replace(/'/g, "''")}' WHERE woo_id = ${Number(r.woo)};  -- ${ket}`
      })
      .join("\n") + "\n",
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}`)

// Dipotong per 100 supaya satu perintah tidak membawa ratusan parameter
// sekaligus, dan kegagalan di tengah tidak menyisakan keadaan yang sulit
// dibaca — berkas pemulihan di atas sudah ditulis lebih dulu, jadi apa pun
// yang terlanjur terlepas tetap bisa dikembalikan.
const woos = target.map((r) => Number(r.woo))
let dilepas = 0
for (let i = 0; i < woos.length; i += 100) {
  const potong = woos.slice(i, i + 100)
  dilepas += await prisma.$executeRawUnsafe(
    `UPDATE products SET accurate_code = NULL WHERE woo_id IN (${potong.map(() => "?").join(",")})`,
    ...potong,
  )
}

const sesudah = await hitung("SELECT COUNT(*) AS n FROM products WHERE accurate_code IS NOT NULL")
const masihSakit = await hitung(`SELECT COUNT(*) AS n ${JOIN} WHERE ${SYARAT}`)
const menggantung = await hitung(
  `SELECT COUNT(*) AS n FROM products p WHERE p.accurate_code IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accurate_products a WHERE a.\`Kode Accurate\` = p.accurate_code)`,
)

console.log("\n=== HASIL ===")
console.log(`  dilepas                 : ${dilepas}`)
console.log(`  tertaut sekarang        : ${sesudah}`)
console.log(`  hitungan cocok          : ${total - dilepas === sesudah ? "ya" : "TIDAK — periksa!"}`)
console.log(`  sisa yang masih 'sakit' : ${masihSakit}  (harus 0)`)
console.log(`  tautan menggantung      : ${menggantung}  (harus 0)`)

await prisma.$disconnect()
