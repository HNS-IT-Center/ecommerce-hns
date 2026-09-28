/**
 * TAHAP 1 dari dua — membuang baris `brands` yang bukan merek.
 *
 * Harus jalan SEBELUM `isi-brand-dari-nama.mts`. Alasannya konkret: tabel
 * `brands` memuat `lga1700` (soket prosesor) dan `RADEON` (lini produk AMD,
 * bukan produsen kartunya). Pengisian otomatis yang mencocokkan nama produk
 * ke daftar brand akan memberi label "LGA1700" kepada motherboard MSI yang
 * kebetulan tidak menyebut "MSI" di posisi yang tercocokkan — dengan penuh
 * percaya diri, dan tanpa ada yang menandainya sebagai tebakan.
 *
 * Yang dibuang HANYA baris yang memenuhi DUA syarat sekaligus:
 *   1. namanya ada di daftar SAMPAH di bawah (ditulis tangan, tidak ditebak), dan
 *   2. nol produk memakainya.
 *
 * Syarat kedua itu rem pengaman: kalau ternyata ada produk yang memakai baris
 * itu, skrip berhenti dan melapor, karena membuang brand yang terpakai akan
 * meng-NULL-kan `products.brand_id` lewat `onDelete: SetNull` tanpa jejak
 * produk mana saja yang kehilangan mereknya.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/bersihkan-brand-sampah.mts
 *
 *   # benar-benar membuang
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/bersihkan-brand-sampah.mts --tulis
 *
 * Berkas pemulihan ditulis ke `backup/` sebelum apa pun dihapus.
 *
 * Aman diulang: baris yang sudah hilang tidak lagi ditemukan.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")

/**
 * Nama baris `brands` yang bukan merek, dicocokkan tanpa peduli huruf besar-kecil.
 *
 * - `lga1700`  — soket prosesor Intel. Muncul di nama hampir semua motherboard
 *                generasi itu, jadi ia pencocok paling berisik di tabel.
 * - `RADEON`   — lini GPU AMD. Produsen kartunya XFX, Sapphire, PowerColor, dst,
 *                dan nama produk biasanya memuat keduanya sekaligus.
 *
 * SENGAJA pendek. Kandidat lain yang sempat ditimbang dan TIDAK dimasukkan:
 *   - `XPG`         — sub-merek ADATA, tapi dipakai sebagai merek di pasar.
 *   - `LEXA GAMING` — tumpang tindih dengan `LEXA`; perlu keputusan mana yang
 *                     dipertahankan, bukan sekadar dibuang.
 *   - `HOSE`        — tampak seperti kata umum, tapi belum dipastikan bukan merek.
 * Ketiganya dilaporkan di akhir skrip sebagai catatan, tidak disentuh.
 */
const SAMPAH = ["lga1700", "RADEON"]

/** Nama yang mencurigakan tapi belum diputuskan — dilaporkan, tidak dibuang. */
const PERLU_DITINJAU = ["XPG", "LEXA GAMING", "LEXA", "HOSE"]

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const url = new URL(cocok[1]!.replace(/^mysql:/, "http:"))

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.host}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

type Brand = { id: number; name: string; slug: string; dipakai: bigint }

const kandidat = await q<Brand>(
  `SELECT b.id, b.name, b.slug, COUNT(p.id) AS dipakai
   FROM brands b LEFT JOIN products p ON p.brand_id = b.id
   WHERE ${SAMPAH.map(() => "LOWER(b.name) = LOWER(?)").join(" OR ")}
   GROUP BY b.id, b.name, b.slug ORDER BY b.name`,
  ...SAMPAH,
)

console.log("=== Kandidat sampah ===")
if (kandidat.length === 0) {
  console.log("  (tidak ada — mungkin sudah dibersihkan sebelumnya)")
} else {
  for (const b of kandidat) {
    console.log(`  id ${String(b.id).padStart(4)}  ${b.name.padEnd(16)} dipakai ${Number(b.dipakai)} produk`)
  }
}

const terpakai = kandidat.filter((b) => Number(b.dipakai) > 0)
if (terpakai.length > 0) {
  console.error("\nBERHENTI — ada kandidat yang masih dipakai produk:")
  for (const b of terpakai) {
    const contoh = await q<{ id: number; name: string }>(
      "SELECT id, name FROM products WHERE brand_id = ? LIMIT 5",
      b.id,
    )
    console.error(`\n  "${b.name}" dipakai ${Number(b.dipakai)} produk, contoh:`)
    for (const p of contoh) console.error(`    ${p.id}  ${p.name.slice(0, 60)}`)
  }
  console.error(
    "\nMenghapusnya akan meng-NULL-kan brand_id produk di atas (onDelete: SetNull).\n" +
      "Pindahkan dulu produknya ke brand yang benar, baru jalankan skrip ini lagi.",
  )
  await prisma.$disconnect()
  process.exit(1)
}

// --------------------------------------------------- catatan, bukan tindakan

const tinjau = await q<Brand>(
  `SELECT b.id, b.name, b.slug, COUNT(p.id) AS dipakai
   FROM brands b LEFT JOIN products p ON p.brand_id = b.id
   WHERE ${PERLU_DITINJAU.map(() => "LOWER(b.name) = LOWER(?)").join(" OR ")}
   GROUP BY b.id, b.name, b.slug ORDER BY b.name`,
  ...PERLU_DITINJAU,
)

if (tinjau.length) {
  console.log("\n=== Perlu keputusan kamu (TIDAK disentuh skrip ini) ===")
  for (const b of tinjau) {
    console.log(`  id ${String(b.id).padStart(4)}  ${b.name.padEnd(16)} dipakai ${Number(b.dipakai)} produk`)
  }
  console.log("  Sub-merek dan nama yang tumpang tindih — perlu dilebur atau dipertahankan,")
  console.log("  bukan sekadar dibuang. Lihat komentar PERLU_DITINJAU di skrip ini.")
}

if (kandidat.length === 0) {
  console.log("\nTidak ada yang perlu dibuang.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar membuang.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/brand-sampah-${stamp}.sql`
writeFileSync(
  berkas,
  `-- ${kandidat.length} baris brands dibuang pada ${stamp}.\n` +
    `-- Semuanya nol produk saat dibuang, jadi tidak ada brand_id yang ikut hilang.\n` +
    `-- Jalankan berkas ini untuk mengembalikannya (id-nya ikut dipulihkan).\n\n` +
    kandidat
      .map(
        (b) =>
          `INSERT INTO brands (id, name, slug) VALUES ` +
          `(${b.id}, '${b.name.replace(/'/g, "''")}', '${b.slug.replace(/'/g, "''")}');`,
      )
      .join("\n") + "\n",
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}`)

const ids = kandidat.map((b) => b.id)
const dibuang = await prisma.$executeRawUnsafe(
  `DELETE FROM brands WHERE id IN (${ids.map(() => "?").join(",")})`,
  ...ids,
)

const sisa = Number((await q<{ n: bigint }>("SELECT COUNT(*) AS n FROM brands"))[0]!.n)
console.log("\n=== HASIL ===")
console.log(`  dibuang        : ${dibuang}`)
console.log(`  brand tersisa  : ${sisa}`)
console.log(`  hitungan cocok : ${dibuang === kandidat.length ? "ya" : "TIDAK — periksa!"}`)
console.log("\nBerikutnya: scripts/isi-brand-dari-nama.mts")

await prisma.$disconnect()
