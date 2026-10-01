/**
 * Menyamakan harga baris induk produk VARIABLE dengan variannya — sekali jalan,
 * untuk data lama. Penyimpanan baru sudah ditangani `updateProduct`.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/sinkron-harga-induk-variable.mts
 *
 *   # benar-benar menulis
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/sinkron-harga-induk-variable.mts --tulis
 *
 * Yang ditulis, untuk setiap induk yang punya minimal satu varian berharga:
 *
 *     regular_price = harga normal varian termurah
 *     sale_price    = NULL
 *     sale_end_date = NULL
 *
 * Aturannya TIDAK ditulis ulang di sini — skrip memanggil
 * `syncVariableParentPrice` dari `lib/api/woocommerce/products.ts`, fungsi yang
 * sama yang dipakai panel admin. Alasan aturannya ada di sana.
 *
 * Kenapa tidak dikosongkan (NULL): sort "Harga" dan filter harga di `/shop`
 * mengurutkan & menyaring langsung pada kolom ini. Induk berharga NULL akan
 * naik ke atas urutan termurah dan hilang dari filter rentang harga.
 *
 * Tidak ada harga yang dilihat pelanggan yang berubah karena skrip ini: toko,
 * halaman produk, dan PC Builder sudah membaca harga varian. Yang berubah
 * hanyalah posisi produk bervarian di sort/filter harga `/shop`.
 *
 * Nilai lama TIDAK hilang: sebelum menulis, berkas pemulihan disimpan di
 * `backup/` berisi perintah UPDATE untuk mengembalikan persis nilai-nilai itu.
 *
 * Aman diulang: induk yang sudah sama dengan variannya tidak lagi memenuhi
 * syarat.
 *
 * Uji di database lokal Docker dulu (docs/16). Ke produksi: ikut docs/16 §1 —
 * tukar `DATABASE_URL` secara sadar, jalankan, lalu kembalikan.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const urlDb = new URL(cocok[1]!.replace(/^mysql:/, "http:"))
const namaDb = urlDb.pathname.slice(1)

const { getPrisma } = await import("../src/lib/prisma/client")
const { syncVariableParentPrice } = await import("../src/lib/api/woocommerce/products")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${namaDb} @ ${urlDb.hostname}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

/**
 * Induk yang kolom harganya berbeda dari hasil `syncVariableParentPrice`.
 * Syarat `min_var` di sini HARUS sama dengan agregat di fungsi itu: seluruh
 * varian, harga normal > 0. Kalau berbeda, uji kering melaporkan rencana yang
 * tidak sama dengan yang benar-benar ditulis.
 */
const SQL_RENCANA = `
  SELECT p.id, p.woo_id AS wooId, p.name AS nama,
         p.regular_price AS regularLama, p.sale_price AS saleLama,
         p.sale_end_date AS saleEndLama, m.min_var AS regularBaru
  FROM products p
  JOIN (SELECT parent_id, MIN(regular_price) AS min_var
        FROM products WHERE parent_id IS NOT NULL AND regular_price > 0
        GROUP BY parent_id) m ON m.parent_id = p.id
  WHERE p.type = 'VARIABLE'
    AND (p.regular_price IS NULL OR p.regular_price <> m.min_var
         OR p.sale_price IS NOT NULL OR p.sale_end_date IS NOT NULL)
  ORDER BY p.id`

type Baris = {
  id: number
  wooId: number | bigint
  nama: string
  regularLama: string | null
  saleLama: string | null
  saleEndLama: Date | null
  regularBaru: string
}

const rencana = await q<Baris>(SQL_RENCANA)

const [{ n: totalInduk }] = await q<{ n: bigint }>(
  "SELECT COUNT(*) AS n FROM products WHERE type = 'VARIABLE'",
)
const [{ n: tanpaVarianBerharga }] = await q<{ n: bigint }>(
  `SELECT COUNT(*) AS n FROM products p WHERE p.type = 'VARIABLE'
   AND NOT EXISTS (SELECT 1 FROM products v WHERE v.parent_id = p.id AND v.regular_price > 0)`,
)

const rp = (v: string | null) => (v === null ? "—" : `Rp ${Number(v).toLocaleString("id-ID")}`)
const obralTersisa = rencana.filter((b) => b.saleLama !== null).length

console.log("=== Rencana ===")
console.log(`  induk VARIABLE                 : ${Number(totalInduk)}`)
console.log(`  akan disamakan                 : ${rencana.length}`)
console.log(`    di antaranya membawa obral   : ${obralTersisa}  (dikosongkan)`)
console.log(`  dilewati, tanpa varian berharga: ${Number(tanpaVarianBerharga)}  (harga induk satu-satunya)`)

console.log("\n=== Contoh (10 teratas) ===")
for (const b of rencana.slice(0, 10)) {
  const lama = `${rp(b.regularLama)}${b.saleLama ? ` / obral ${rp(b.saleLama)}` : ""}`
  console.log(`  #${String(b.id).padEnd(6)} ${lama.padEnd(36)} → ${rp(b.regularBaru).padEnd(14)} ${b.nama.slice(0, 40)}`)
}

if (rencana.length === 0) {
  console.log("\nTidak ada yang perlu disamakan.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const sqlNilai = (v: string | Date | null) =>
  v === null ? "NULL" : v instanceof Date ? `'${v.toISOString().slice(0, 23).replace("T", " ")}'` : `'${v}'`

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
mkdirSync("backup", { recursive: true })
const berkas = `backup/harga-induk-variable-${namaDb}-${stamp}.sql`
writeFileSync(
  berkas,
  `-- ${rencana.length} induk VARIABLE disamakan dengan variannya pada ${stamp} (database ${namaDb})\n` +
    `-- Jalankan seluruh berkas ini untuk mengembalikan nilai-nilai lamanya.\n` +
    `-- sale_end_date dicatat dalam UTC.\n\n` +
    rencana
      .map(
        (b) =>
          `UPDATE products SET regular_price = ${sqlNilai(b.regularLama)}, sale_price = ${sqlNilai(b.saleLama)}, ` +
          `sale_end_date = ${sqlNilai(b.saleEndLama)} WHERE id = ${b.id};  -- ${b.nama.replace(/\r?\n/g, " ").slice(0, 48)}`,
      )
      .join("\n") +
    "\n",
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}  (${rencana.length} baris)`)

let selesai = 0
for (const b of rencana) {
  await syncVariableParentPrice(prisma, b.id)
  selesai++
  if (selesai % 100 === 0) console.log(`  … ${selesai}/${rencana.length}`)
}

const sisa = await q<Baris>(SQL_RENCANA)
console.log("\n=== HASIL ===")
console.log(`  disamakan : ${selesai}`)
console.log(`  sisa beda : ${sisa.length}  (harus 0)`)
console.log(
  "\nCache halaman toko kedaluwarsa sendiri dalam 5–10 menit. Untuk menyegarkannya seketika di produksi:\n" +
    `  curl -X POST "$SITE/api/revalidate" -H "x-revalidate-secret: $REVALIDATE_SECRET" \\\n` +
    `    -H "content-type: application/json" -d '{"tags":["products","all-products"]}'`,
)

await prisma.$disconnect()
process.exit(sisa.length === 0 ? 0 : 1)
