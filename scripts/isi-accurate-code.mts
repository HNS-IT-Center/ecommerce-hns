/**
 * Isi awal `products.accurate_code` dari pemetaan `accurate_woo_mapping` lama.
 *
 * Dipakai sekali per database, sesudah migrasi
 * `20260908082629_add_product_accurate_code` diterapkan. Rencana lengkapnya:
 * docs/13-sinkronisasi-harga-accurate.md.
 *
 *   # uji kering di database uji (bawaan — sengaja yang paling aman)
 *   npx tsx scripts/isi-accurate-code.mts
 *
 *   # tulis ke database uji
 *   npx tsx scripts/isi-accurate-code.mts --tulis
 *
 *   # tulis ke PRODUKSI (hanya setelah hasil di uji dipuaskan)
 *   npx tsx scripts/isi-accurate-code.mts --tulis --produksi
 *
 * Bawaannya database UJI dan mode uji-kering. Dua sengaja: yang paling mudah
 * diketik adalah yang paling tidak berbahaya, dan menyentuh produksi menuntut
 * dua bendera yang harus ditulis sadar.
 *
 * ATURAN YANG DITERAPKAN (semua dari docs/13):
 *
 *  1. Hanya pemetaan yang menunjuk produk web SUNGGUHAN — `woo_product_id > 0`
 *     DAN barisnya ada di `products`. Bukan sekadar `IS NOT NULL`: 1.092 baris
 *     berskor 100 menunjuk `woo_product_id = 0`, yang bukan produk apa pun.
 *  2. Hanya `needs_review = 0` dan `confidence_score >= 90`.
 *  3. Satu produk beberapa kode → yang berawalan `2` menang. Awalan `1` skema
 *     lama yang 71% isinya sudah tidak aktif.
 *  4. Kode yang diperebutkan lebih dari satu produk DILEWATI, tidak ditebak —
 *     kolomnya unik, dan menebak berarti harga bisa mendarat di produk yang
 *     salah.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { readFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const ENV_KEY = PRODUKSI ? "DATABASE_URL" : "RESTORE_UJI_DATABASE_URL"

const cocok = readFileSync(".env.local", "utf8").match(
  new RegExp(`^${ENV_KEY}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"),
)
if (!cocok) {
  console.error(`${ENV_KEY} tidak ada di .env.local`)
  process.exit(1)
}
const raw = cocok[1]!
const url =
  raw.replace(/^mysql:\/\//, "mariadb://") + (raw.includes("?") ? "&" : "?") + "connectionLimit=2"
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(url, { useTextProtocol: true }) })

const namaDb = new URL(raw.replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

type Baris = { woo: number; kode: string }

const kandidat = await prisma.$queryRawUnsafe<Baris[]>(
  `SELECT m.woo_product_id AS woo, m.kode_accurate AS kode
   FROM accurate_woo_mapping m
   JOIN products p ON p.woo_id = m.woo_product_id
   JOIN accurate_products a ON a.\`Kode Accurate\` = m.kode_accurate
   WHERE m.needs_review = 0 AND m.confidence_score >= 90 AND m.woo_product_id > 0`,
)
console.log(`Kandidat setelah saringan produk-sungguhan : ${kandidat.length}`)

/** Awalan "2" menang; selain itu kode terkecil, supaya hasilnya bisa diulang. */
function pilihTerbaik(list: Baris[]): Baris {
  const dua = list.filter((b) => b.kode.startsWith("2"))
  const pakai = dua.length > 0 ? dua : list
  return [...pakai].sort((a, b) => a.kode.localeCompare(b.kode))[0]!
}

const perProduk = new Map<number, Baris[]>()
for (const b of kandidat) perProduk.set(b.woo, [...(perProduk.get(b.woo) ?? []), b])
const pilihan = [...perProduk.entries()].map(([woo, list]) => ({ woo, kode: pilihTerbaik(list).kode }))
console.log(`Produk dengan >1 kode                     : ${[...perProduk.values()].filter((v) => v.length > 1).length} (dipilih awalan 2)`)

const perKode = new Map<string, number[]>()
for (const p of pilihan) perKode.set(p.kode, [...(perKode.get(p.kode) ?? []), p.woo])
const bentrok = [...perKode.entries()].filter(([, v]) => v.length > 1)
console.log(`Kode diperebutkan >1 produk (dilewati)     : ${bentrok.length}`)
for (const [kode, woos] of bentrok.slice(0, 10)) console.log(`   ${kode} → woo ${woos.join(", ")}`)

const aman = pilihan.filter((p) => (perKode.get(p.kode) ?? []).length === 1)
console.log(`\nSiap ditulis : ${aman.length}`)
console.log(`   awalan 2  : ${aman.filter((p) => p.kode.startsWith("2")).length}`)
console.log(`   awalan 1  : ${aman.filter((p) => p.kode.startsWith("1")).length}`)
console.log(`   lainnya   : ${aman.filter((p) => !/^[12]/.test(p.kode)).length}`)

if (!TULIS) {
  console.log("\n(uji kering — tambahkan --tulis untuk menerapkan)")
  await prisma.$disconnect()
  process.exit(0)
}

// `accurate_code IS NULL` di WHERE: menjalankan ulang skrip ini tidak menimpa
// penambat yang sudah ditetapkan orang lewat panel.
let ditulis = 0
for (const p of aman) {
  ditulis += await prisma.$executeRawUnsafe(
    "UPDATE products SET accurate_code = ? WHERE woo_id = ? AND accurate_code IS NULL",
    p.kode,
    p.woo,
  )
}
const terisi = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
  "SELECT COUNT(*) AS n FROM products WHERE accurate_code IS NOT NULL",
)
console.log(`\nTertulis                     : ${ditulis}`)
console.log(`Produk ber-accurate_code kini : ${Number(terisi[0]!.n)}`)

await prisma.$disconnect()
