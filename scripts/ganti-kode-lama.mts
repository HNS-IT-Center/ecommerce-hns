/**
 * Ganti tautan produk web dari kode Accurate LAMA (1xxxxx / non-2) ke kode BARU berawalan 2.
 *
 * Aturan user (14 Okt 2026): selalu pakai kode berawalan 2, jangan kode 1xxxxx. Skrip ini
 * hanya untuk produk yang SUDAH tertaut ke kode lama dan padanan kode barunya sudah
 * dipastikan (backup/cocokkan-tautan/keputusan-ganti-kode.json). terapkan-usulan-tautan.mts
 * sengaja tidak menimpa tautan yang sudah ada, jadi penggantian dipisah ke sini.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/ganti-kode-lama.mts
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --masukan <berkas.json>    # bawaan: backup/cocokkan-tautan/keputusan-ganti-kode.json
 *   ... --oleh "Nama"              # nama di log produk
 *
 * Tiap baris diperiksa ulang ke database: produk masih memegang kode lama, nama belum
 * berubah, kode baru berawalan 2, ada di accurate_products atau accurate_items, tidak ditandai tidak dijual,
 * dan belum menambat produk lain. SKU yang sama dengan kode lama ikut diganti kode baru.
 * Berkas pemulihan ditulis SEBELUM satu baris pun berubah.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const MASUKAN = arg("--masukan") ?? "backup/cocokkan-tautan/keputusan-ganti-kode.json"
const OLEH = arg("--oleh") ?? "Ganti kode lama ke kode 2"

const envMap: Record<string, string> = {}
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  envMap[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "")
  process.env[m[1]!] ??= envMap[m[1]!]
}
if (PRODUKSI) {
  if (!envMap.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL tidak ada di .env.local — berhenti.")
    process.exit(1)
  }
  process.env.DATABASE_URL = envMap.PROD_DATABASE_URL
}

type Baris = { wooId: number; kodeLama: string; kodeBaru: string; namaWeb: string; catatan?: string }
const masukan = (JSON.parse(readFileSync(MASUKAN, "utf8")) as { ganti: Baris[] }).ganti

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Masukan  : ${MASUKAN} — ${masukan.length} penggantian\n`)

const ringkas = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase()
const hitungWoo = new Map<number, number>()
const hitungBaru = new Map<string, number>()
for (const b of masukan) {
  hitungWoo.set(b.wooId, (hitungWoo.get(b.wooId) ?? 0) + 1)
  hitungBaru.set(b.kodeBaru, (hitungBaru.get(b.kodeBaru) ?? 0) + 1)
}

type Rencana = Baris & { sku: string | null }
const rencana: Rencana[] = []
const lewat = new Map<string, Baris[]>()
const catat = (alasan: string, b: Baris) => lewat.set(alasan, [...(lewat.get(alasan) ?? []), b])
for (const b of masukan) {
  const [p] = await prisma.$queryRawUnsafe<{ nama: string; kode: string | null; sku: string | null }[]>(
    "SELECT name AS nama, accurate_code AS kode, sku FROM products WHERE woo_id = ?",
    b.wooId,
  )
  const [adaBaru] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT (SELECT COUNT(*) FROM accurate_products WHERE `Kode Accurate` = ?) + " +
      "(SELECT COUNT(*) FROM accurate_items WHERE code = ? AND status <> 'deleted') AS n",
    b.kodeBaru,
    b.kodeBaru,
  )
  const [diabaikan] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM accurate_ignored WHERE kode_accurate = ?",
    b.kodeBaru,
  )
  const pemegang = await prisma.$queryRawUnsafe<{ w: number | bigint }[]>(
    "SELECT woo_id AS w FROM products WHERE accurate_code = ? AND woo_id <> ?",
    b.kodeBaru,
    b.wooId,
  )
  if (hitungWoo.get(b.wooId)! > 1 || hitungBaru.get(b.kodeBaru)! > 1) catat("produk/kode baru muncul lebih dari sekali di masukan", b)
  else if (!b.kodeBaru.startsWith("2")) catat("kode baru tidak berawalan 2", b)
  else if (!p) catat("produk web tidak ditemukan", b)
  else if (p.kode === b.kodeBaru) catat("sudah memegang kode baru (tidak perlu apa-apa)", b)
  else if (p.kode !== b.kodeLama) catat(`produk tidak lagi memegang kode lama (sekarang: ${p.kode ?? "kosong"})`, b)
  else if (ringkas(p.nama) !== ringkas(b.namaWeb)) catat("nama produk web berubah sejak ditinjau", b)
  else if (Number(adaBaru?.n ?? 0) === 0) catat("kode baru tidak dikenal (tidak ada di Sheet maupun API Accurate)", b)
  else if (Number(diabaikan?.n ?? 0) > 0) catat("kode baru ditandai tidak dijual di web", b)
  else if (pemegang.length) catat(`kode baru sudah menambat produk lain (${pemegang.map((x) => Number(x.w)).join(", ")})`, b)
  else rencana.push({ ...b, sku: p.sku })
}

console.log(`=== RENCANA ===`)
console.log(`Akan diganti : ${rencana.length}`)
console.log(`Dilewati     : ${masukan.length - rencana.length}`)
for (const [alasan, arr] of lewat) {
  console.log(`  - ${alasan}: ${arr.length}`)
  for (const b of arr) console.log(`      ${b.wooId} ${b.kodeLama} -> ${b.kodeBaru} ${b.namaWeb.slice(0, 60)}`)
}
console.log(`\n--- Rincian ---`)
for (const b of rencana)
  console.log(`  ${b.wooId} ${b.kodeLama} -> ${b.kodeBaru}${b.sku === b.kodeLama ? " (+SKU)" : ""} | ${b.namaWeb.slice(0, 65)}`)

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/ganti-kode-lama-${stamp}.sql`
const kutip = (s: string) => `'${s.replace(/'/g, "''")}'`
writeFileSync(
  berkasBackup,
  `-- Pemulihan ganti-kode-lama, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Mengembalikan kode lama HANYA kalau produk masih memegang kode baru dari skrip ini.\n\n` +
    rencana
      .map(
        (b) =>
          `UPDATE products SET accurate_code = ${kutip(b.kodeLama)} WHERE woo_id = ${b.wooId} AND accurate_code = ${kutip(b.kodeBaru)};` +
          (b.sku === b.kodeLama
            ? `\nUPDATE products SET sku = ${kutip(b.kodeLama)} WHERE woo_id = ${b.wooId} AND sku = ${kutip(b.kodeBaru)};`
            : ""),
      )
      .join("\n") +
    "\n",
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let berhasil = 0
let skuDiganti = 0
const gagal: string[] = []
for (const b of rencana) {
  try {
    const h = await tautkanKode(b.wooId, b.kodeBaru, OLEH)
    if (!h.ok) {
      gagal.push(`${b.wooId} ${b.kodeLama} -> ${b.kodeBaru}: ${h.alasan}`)
      continue
    }
    berhasil++
    if (b.sku === b.kodeLama) {
      skuDiganti += await prisma.$executeRawUnsafe(
        "UPDATE products SET sku = ? WHERE woo_id = ? AND sku = ?",
        b.kodeBaru,
        b.wooId,
        b.kodeLama,
      )
    }
  } catch (e) {
    gagal.push(`${b.wooId} ${b.kodeLama} -> ${b.kodeBaru}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

let terverifikasi = 0
for (const b of rencana) {
  const [r] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM products WHERE woo_id = ? AND accurate_code = ?",
    b.wooId,
    b.kodeBaru,
  )
  terverifikasi += Number(r?.n ?? 0)
}
console.log(`\n=== HASIL ===`)
console.log(`Berhasil diganti   : ${berhasil} (SKU ikut diganti: ${skuDiganti})`)
console.log(`Terverifikasi di DB: ${terverifikasi} dari ${rencana.length}`)
console.log(`Gagal              : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
await prisma.$disconnect()
