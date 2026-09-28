/**
 * TAHAP 2 dari dua — mengisi `products.brand_id` yang kosong dari nama produk.
 *
 * Jalankan `bersihkan-brand-sampah.mts` LEBIH DULU. Skrip ini menolak jalan
 * kalau baris brand yang bukan merek masih ada, karena pencocokan nama akan
 * menyebarkannya ke ribuan produk.
 *
 * Keadaan yang ditangani: 3.059 dari 5.475 produk (56%) tidak punya brand,
 * 2.912 di antaranya `PUBLISHED`. Filter merek di /shop karena itu bolong —
 * pengunjung yang menyaring "TP-LINK" tidak melihat 15 router TP-LINK yang
 * mereknya tidak tertaut.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/isi-brand-dari-nama.mts
 *
 *   # hanya kategori tertentu, untuk mencoba di lingkup kecil dulu
 *   npx tsx ... scripts/isi-brand-dari-nama.mts --kategori=62
 *
 *   # benar-benar mengisi
 *   npx tsx ... scripts/isi-brand-dari-nama.mts --tulis
 *
 * ATURAN YANG MENENTUKAN AMANNYA:
 *
 *  1. **Hanya produk yang brand-nya NULL.** Brand yang sudah diisi staff tidak
 *     pernah ditimpa — tangan manusia menang atas tebakan mesin.
 *  2. **Hanya cocok TEPAT SATU brand.** Nama yang memuat dua nama brand
 *     (misal "XFX ... RADEON", "ADATA XPG") dilewati dan dilaporkan, bukan
 *     ditebak. Pencocokan ganda hampir selalu berarti salah satunya sub-merek
 *     atau lini produk, dan memilih otomatis di antaranya adalah menebak.
 *  3. **Kata utuh, bukan substring.** Tanpa ini "HP" akan cocok dengan
 *     "SHARP", "GRAPHICS", dan setiap kata yang memuat h-p berurutan.
 *  4. **Brand tidak boleh muncul SETELAH kata kompatibilitas.** Merek yang
 *     disebut sesudah "FOR", "UNTUK", "COMPATIBLE WITH" adalah merek barang
 *     LAIN — "mousepad for Logitech", "charger untuk Samsung". Aturan ini
 *     menyasar sebab kesalahan itu langsung.
 *
 *     Versi pertama aturan ini memakai ambang posisi ("brand harus di 12
 *     karakter pertama"). DIBUANG karena membuang 380 produk yang justru
 *     benar: "POWER SUPPLY DIGITAL ALLIANCE PBZ550" menaruh brand di posisi
 *     13, lewat ambang, padahal jelas merek produk itu sendiri. Ambang posisi
 *     mengukur hal yang salah — panjang kata kategori di depannya, bukan
 *     apakah mereknya benar.
 *
 * Yang tidak memenuhi syarat DILAPORKAN, tidak didiamkan. Masukan yang cacat
 * tetap dibaca, tapi wajib bercatatan.
 *
 * Berkas pemulihan ditulis ke `backup/` sebelum baris pertama berubah.
 * Aman diulang: produk yang sudah punya brand tidak lagi memenuhi syarat.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")
const argKategori = process.argv.find((a) => a.startsWith("--kategori="))
const KATEGORI = argKategori ? Number(argKategori.split("=")[1]) : null

if (argKategori && !Number.isInteger(KATEGORI)) {
  console.error(`--kategori harus angka, dapat "${argKategori.split("=")[1]}"`)
  process.exit(1)
}

/** Baris brands yang bukan merek; keberadaannya memblokir skrip ini. */
const SAMPAH = ["lga1700", "RADEON"]

/**
 * Kata yang menandai "yang disebut sesudah ini adalah merek barang LAIN".
 *
 * Contoh yang disasar: "MOUSEPAD GAMING FOR LOGITECH", "CHARGER UNTUK
 * SAMSUNG" — di situ Logitech dan Samsung bukan merek barang yang dijual.
 *
 * Diukur 28 September 2026: aturan ini menyaring NOL produk di katalog
 * sekarang. Kata "FOR" memang muncul (±40 produk) tapi selalu diikuti kata
 * benda umum — "FOR CPU", "FOR PRODUCTIVITY" — dan mereknya selalu di depan.
 * Aturannya dipertahankan sebagai penjaga untuk nama produk yang akan datang;
 * angka 0 di keluaran berarti "tidak ada yang melanggar", bukan "aturan mati".
 */
const KATA_KOMPATIBILITAS = /(FOR|UNTUK|COMPATIBLE|COCOK UNTUK|KHUSUS)/i

const cocokEnv = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocokEnv) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const url = new URL(cocokEnv[1]!.replace(/^mysql:/, "http:"))

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.host}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Lingkup  : ${KATEGORI === null ? "seluruh katalog" : `kategori id ${KATEGORI} saja`}\n`)

// ------------------------------------------- rem: tabel brands harus bersih

const sampahTersisa = await q<{ id: number; name: string }>(
  `SELECT id, name FROM brands WHERE ${SAMPAH.map(() => "LOWER(name) = LOWER(?)").join(" OR ")}`,
  ...SAMPAH,
)
if (sampahTersisa.length > 0) {
  console.error("BERHENTI — baris brands yang bukan merek masih ada:")
  for (const b of sampahTersisa) console.error(`  id ${b.id}  ${b.name}`)
  console.error("\nJalankan dulu: scripts/bersihkan-brand-sampah.mts --tulis")
  await prisma.$disconnect()
  process.exit(1)
}

// ------------------------------------------------------------------ memuat

const brands = await q<{ id: number; name: string }>("SELECT id, name FROM brands ORDER BY LENGTH(name) DESC")

const produk = await q<{ id: number; nama: string; status: string }>(
  KATEGORI === null
    ? "SELECT id, name AS nama, status FROM products WHERE brand_id IS NULL ORDER BY id"
    : `SELECT p.id, p.name AS nama, p.status FROM products p
       JOIN product_categories pc ON pc.product_id = p.id
       WHERE p.brand_id IS NULL AND pc.category_id = ? ORDER BY p.id`,
  ...(KATEGORI === null ? [] : [KATEGORI]),
)

console.log(`brand terdaftar   : ${brands.length}`)
console.log(`produk tanpa brand: ${produk.length}\n`)

// ---------------------------------------------------------------- mencocok

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

type Hasil = { id: number; nama: string; brandId: number; brandNama: string }
const akanDiisi: Hasil[] = []
const ambigu: { id: number; nama: string; kandidat: string[] }[] = []
const jauh: { id: number; nama: string; brandNama: string; posisi: number }[] = []
const nihil: { id: number; nama: string }[] = []

for (const p of produk) {
  const nama = p.nama.replace(/\r?\n/g, " ")
  const atas = nama.toUpperCase()

  const kena = brands.filter((b) =>
    new RegExp(`(^|[^A-Z0-9])${escapeRegex(b.name.toUpperCase())}([^A-Z0-9]|$)`).test(atas),
  )

  if (kena.length === 0) {
    nihil.push({ id: p.id, nama })
    continue
  }
  if (kena.length > 1) {
    ambigu.push({ id: p.id, nama, kandidat: kena.map((b) => b.name) })
    continue
  }

  const b = kena[0]!
  const posisi = atas.indexOf(b.name.toUpperCase())

  // Aturan 4: brand yang disebut SETELAH kata kompatibilitas adalah merek
  // barang lain, bukan merek produk ini.
  const kompat = atas.search(KATA_KOMPATIBILITAS)
  if (kompat !== -1 && posisi > kompat) {
    jauh.push({ id: p.id, nama, brandNama: b.name, posisi })
    continue
  }

  akanDiisi.push({ id: p.id, nama, brandId: b.id, brandNama: b.name })
}

console.log("=== Hasil pencocokan ===")
console.log(`  AKAN DIISI (aman)        : ${akanDiisi.length}`)
console.log(`  ambigu, >1 brand cocok   : ${ambigu.length}`)
console.log(`  brand jauh di tengah nama: ${jauh.length}`)
console.log(`  tidak cocok apa pun      : ${nihil.length}`)
console.log(`  jumlah                   : ${akanDiisi.length + ambigu.length + jauh.length + nihil.length} (harus ${produk.length})`)

const perBrand = new Map<string, number>()
for (const h of akanDiisi) perBrand.set(h.brandNama, (perBrand.get(h.brandNama) ?? 0) + 1)
const urut = [...perBrand].sort((a, b) => b[1] - a[1])

console.log("\n=== Brand terbanyak yang akan diisi ===")
for (const [n, j] of urut.slice(0, 15)) console.log(`  ${String(j).padStart(4)}  ${n}`)
if (urut.length > 15) console.log(`  ... dan ${urut.length - 15} brand lain`)

console.log("\n=== Contoh 10 yang akan diisi ===")
for (const h of akanDiisi.slice(0, 10)) {
  console.log(`  ${String(h.id).padStart(5)}  ${h.brandNama.padEnd(14)} <- ${h.nama.slice(0, 52)}`)
}

if (ambigu.length) {
  console.log(`\n=== DILEWATI: >1 brand cocok (${ambigu.length}) — perlu tangan manusia ===`)
  for (const a of ambigu.slice(0, 10)) {
    console.log(`  ${String(a.id).padStart(5)}  [${a.kandidat.join(" + ")}]  ${a.nama.slice(0, 44)}`)
  }
  if (ambigu.length > 10) console.log(`  ... dan ${ambigu.length - 10} lagi`)
}

if (jauh.length) {
  console.log(`\n=== DILEWATI: brand disebut jauh di tengah nama (${jauh.length}) ===`)
  for (const j of jauh.slice(0, 10)) {
    console.log(`  ${String(j.id).padStart(5)}  ${j.brandNama.padEnd(12)} @${String(j.posisi).padStart(3)}  ${j.nama.slice(0, 46)}`)
  }
  if (jauh.length > 10) console.log(`  ... dan ${jauh.length - 10} lagi`)
  console.log("  Merek barang LAIN yang disebut sebagai keterangan kecocokan.")
}

if (nihil.length) {
  console.log(`\n=== DILEWATI: tidak ada brand yang cocok (${nihil.length}) ===`)
  for (const n of nihil.slice(0, 10)) console.log(`  ${String(n.id).padStart(5)}  ${n.nama.slice(0, 62)}`)
  if (nihil.length > 10) console.log(`  ... dan ${nihil.length - 10} lagi`)
  console.log("  Sebagian merek yang belum terdaftar di tabel brands (mis. ELGATO, T-FORCE),")
  console.log("  sebagian memang tidak bermerek (mis. JASA RAKIT PC).")
}

if (akanDiisi.length === 0) {
  console.log("\nTidak ada yang bisa diisi dengan aman.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar mengisi.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/brand-diisi-${stamp}.sql`
writeFileSync(
  berkas,
  `-- ${akanDiisi.length} produk diisi brand_id pada ${stamp}.\n` +
    `-- Semuanya brand_id NULL sebelum ini, jadi pemulihannya mengosongkan kembali.\n` +
    `-- Produk yang brand-nya sudah diisi staff tidak pernah tersentuh.\n\n` +
    `UPDATE products SET brand_id = NULL WHERE id IN (\n` +
    akanDiisi.map((h) => `  ${h.id}`).join(",\n") +
    `\n);\n`,
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}`)

// Dikelompokkan per brand supaya jumlah perintah sebanyak brand, bukan produk.
let diisi = 0
const perBrandId = new Map<number, number[]>()
for (const h of akanDiisi) {
  if (!perBrandId.has(h.brandId)) perBrandId.set(h.brandId, [])
  perBrandId.get(h.brandId)!.push(h.id)
}

await prisma.$transaction(async (tx) => {
  for (const [brandId, ids] of perBrandId) {
    for (let i = 0; i < ids.length; i += 200) {
      const potong = ids.slice(i, i + 200)
      diisi += await tx.$executeRawUnsafe(
        `UPDATE products SET brand_id = ? WHERE id IN (${potong.map(() => "?").join(",")}) AND brand_id IS NULL`,
        brandId,
        ...potong,
      )
    }
  }
})

const sisaNull = Number(
  (await q<{ n: bigint }>("SELECT COUNT(*) AS n FROM products WHERE brand_id IS NULL"))[0]!.n,
)

console.log("\n=== HASIL ===")
console.log(`  diisi              : ${diisi}`)
console.log(`  hitungan cocok     : ${diisi === akanDiisi.length ? "ya" : "TIDAK — periksa!"}`)
console.log(`  sisa tanpa brand   : ${sisaNull}`)
console.log(`  (sisa itu ${ambigu.length} ambigu + ${jauh.length} jauh + ${nihil.length} nihil + di luar lingkup)`)

await prisma.$disconnect()
