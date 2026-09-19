/**
 * Mengosongkan harga Accurate yang nilainya jelas rusak.
 *
 * Yang dianggap rusak: harga di bawah Rp 1.000 — ambang yang sama dengan
 * `AMBANG_HARGA_RENDAH` di `lib/api/accurate/stock-db.ts`. Untuk katalog
 * komputer, tidak ada barang seharga Rp 6 atau Rp 165; angka seperti itu adalah
 * sisa pembacaan yang memotong ribuan ("165.000" terbaca sebagai 165).
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/reset-harga-accurate-rusak.mts
 *
 *   # benar-benar mengosongkan
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/reset-harga-accurate-rusak.mts --tulis
 *
 * **BARANGNYA TIDAK DIHAPUS.** Hanya nilai harganya yang dikosongkan, dan hanya
 * kolom yang rusak — baris yang SP-nya rusak tapi CP-nya sehat hanya kehilangan
 * SP-nya. Barang seperti TINTA CANON GI-71 berstok 191 tetap ada di daftar,
 * hanya tanpa harga.
 *
 * Kenapa dikosongkan dan bukan dibiarkan: "Rp 6" di kolom harga lebih
 * menyesatkan daripada kosong. Kosong menyatakan "kami tidak tahu"; angka palsu
 * menyatakan "kami tahu" dan butuh membaca peringatan kecil untuk tahu ia
 * bohong. Ia juga mencemari antrean kerja — 52 barang masuk daftar "sudah punya
 * harga" padahal harganya tidak terpakai.
 *
 * Kenapa TIDAK dikalikan 1.000: menebak harga yang berakhir di layar pelanggan
 * dilarang (CLAUDE.md §2.7), dan `parseHargaAccurate` sudah menolak melakukan
 * hal yang sama dengan alasan yang sama — "165" mungkin 165.000, tapi "1"
 * mungkin 1.000, 1.000.000, atau salah ketik.
 *
 * Nilai lamanya TIDAK hilang: sebelum menulis, skrip ini menyimpan berkas
 * pemulihan di `backup/` berisi perintah UPDATE untuk mengembalikan persis
 * nilai-nilai itu. Petunjuk "165" tetap bisa dibaca dari sana saat sumber harga
 * yang benar tersedia.
 *
 * Aman diulang: nilai yang sudah kosong tidak lagi memenuhi syarat.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")

/** Sama dengan AMBANG_HARGA_RENDAH di lib/api/accurate/stock-db.ts. */
const AMBANG = 1000

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const namaDb = new URL(cocok[1]!.replace(/^mysql:/, "http:")).pathname.slice(1)

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${namaDb}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Ambang   : di bawah Rp ${AMBANG.toLocaleString("id-ID")}\n`)

const KOLOM = ["SP", "CP", "PRICE"] as const
type Kolom = (typeof KOLOM)[number]

/**
 * Titik dibuang sebelum dibandingkan supaya "7.290.000" tidak terbaca 7,29 lalu
 * ikut terhapus. Spasi di ujung juga ada di data ("115  "), dan CAST diam-diam
 * mengabaikannya — tapi ditulis eksplisit agar syaratnya tidak bergantung pada
 * kebaikan hati MariaDB.
 */
const syaratRusak = (k: Kolom) =>
  `\`${k}\` IS NOT NULL AND TRIM(\`${k}\`) <> ''
   AND CAST(REPLACE(TRIM(\`${k}\`), '.', '') AS DECIMAL(18,0)) BETWEEN 1 AND ${AMBANG - 1}`

type Baris = { kode: string; nama: string; nilai: string }

const rencana: { kolom: Kolom; baris: Baris[] }[] = []
for (const k of KOLOM) {
  const baris = await q<Baris>(
    `SELECT \`Kode Accurate\` AS kode, \`NAMA BARANG\` AS nama, \`${k}\` AS nilai
     FROM accurate_products WHERE ${syaratRusak(k)} ORDER BY \`Kode Accurate\``,
  )
  rencana.push({ kolom: k, baris })
}

console.log("=== Yang akan dikosongkan ===")
let total = 0
for (const r of rencana) {
  console.log(`  ${r.kolom.padEnd(6)}: ${r.baris.length}`)
  total += r.baris.length
}
console.log(`  ${"TOTAL".padEnd(6)}: ${total} nilai`)

const barisUnik = new Set(rencana.flatMap((r) => r.baris.map((b) => b.kode)))
console.log(`\n  menyentuh ${barisUnik.size} barang — TIDAK ADA yang dihapus, hanya harganya`)

console.log("\n=== Contoh (8 teratas) ===")
for (const r of rencana) {
  for (const b of r.baris.slice(0, 3)) {
    console.log(`  ${r.kolom.padEnd(6)} ${b.kode.padEnd(12)} "${b.nilai.trim()}"  ${b.nama.slice(0, 40)}`)
  }
}

if (total === 0) {
  console.log("\nTidak ada yang perlu dikosongkan.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar mengosongkan.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/accurate-harga-rusak-${stamp}.sql`
const barisSql: string[] = []
for (const r of rencana) {
  for (const b of r.baris) {
    const nilai = b.nilai.replace(/'/g, "''")
    barisSql.push(
      `UPDATE accurate_products SET \`${r.kolom}\` = '${nilai}' WHERE \`Kode Accurate\` = '${b.kode.replace(/'/g, "''")}';  -- ${b.nama.replace(/\r?\n/g, " ").slice(0, 48)}`,
    )
  }
}
writeFileSync(
  berkas,
  `-- ${total} nilai harga Accurate dikosongkan pada ${stamp}\n` +
    `-- Sebab: nilainya di bawah Rp ${AMBANG} — sisa pembacaan yang memotong ribuan.\n` +
    `-- Barangnya sendiri TIDAK dihapus; hanya kolom harga yang dikosongkan.\n` +
    `-- Jalankan seluruh berkas ini untuk mengembalikan nilai-nilai lamanya.\n` +
    `--\n` +
    `-- Berkas ini juga arsip petunjuknya: "165" pada Mouse Logitech M171 hampir\n` +
    `-- pasti berarti Rp 165.000. Saat sumber harga yang benar tersedia, daftar\n` +
    `-- di sini bisa dipakai memeriksa apakah harga barunya masuk akal.\n\n` +
    barisSql.join("\n") + "\n",
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}  (${total} nilai)`)

let dikosongkan = 0
for (const r of rencana) {
  if (r.baris.length === 0) continue
  const kode = r.baris.map((b) => b.kode)
  // Dipotong per 200 supaya satu perintah tidak membawa ratusan parameter.
  for (let i = 0; i < kode.length; i += 200) {
    const potong = kode.slice(i, i + 200)
    dikosongkan += await prisma.$executeRawUnsafe(
      `UPDATE accurate_products SET \`${r.kolom}\` = NULL
       WHERE \`Kode Accurate\` IN (${potong.map(() => "?").join(",")}) AND ${syaratRusak(r.kolom)}`,
      ...potong,
    )
  }
}

console.log("\n=== HASIL ===")
console.log(`  nilai dikosongkan : ${dikosongkan}`)

const sisa = await q<{ n: bigint }>(
  `SELECT COUNT(*) AS n FROM accurate_products
   WHERE (${syaratRusak("SP")}) OR (${syaratRusak("CP")}) OR (${syaratRusak("PRICE")})`,
)
console.log(`  sisa yang rusak   : ${Number(sisa[0]!.n)}  (harus 0)`)

const barangHilang = await q<{ n: bigint }>("SELECT COUNT(*) AS n FROM accurate_products")
console.log(`  barang di Accurate: ${Number(barangHilang[0]!.n)}  (tidak berkurang)`)

await prisma.$disconnect()
