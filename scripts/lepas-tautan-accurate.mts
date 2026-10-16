/**
 * Lepas tautan kode Accurate dari produk web — untuk tautan yang SALAH dan tidak
 * punya kode pengganti. ganti-kode-lama.mts hanya bisa mengganti ke kode lain.
 *
 * Latar (15 Okt 2026): penulisan 14 Okt menautkan A-258 GREEN (2504000075) ke
 * variasi OCB-258 HIJAU (19402). OCB-258 = B-258, dan B-258 hanya ada warna BLACK
 * di Accurate. Tombol "Lepas tautan" di Update Harga hanya melepas kodenya: SKU
 * yang sama dengan kode tertinggal (dan memblokir penautan berikutnya, karena SKU
 * unik), dan stok terakhir hasil sinkron juga tertinggal tanpa pernah diperbarui
 * lagi — pelanggan bisa memesan barang yang tidak ada.
 *
 * Per baris: kode dilepas lewat tautkanKode(wooId, null) — jalur yang sama dengan
 * tombol admin, tercatat UNLINK_ACCURATE; SKU yang sama dengan kode dikosongkan;
 * dan kalau `habiskan: true`, stok ditandai OUTOFSTOCK (+ log BULK_STOCK_STATUS).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/lepas-tautan-accurate.mts --masukan <berkas.json>
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --oleh "Nama"              # nama di log produk
 *
 * Masukan: { "lepas": [{ "wooId", "kode", "namaWeb", "habiskan"?, "catatan"? }] }
 * Tiap baris diperiksa ulang: produk masih memegang kode itu dan namanya belum
 * berubah. Berkas pemulihan ditulis SEBELUM satu baris pun berubah.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const MASUKAN = arg("--masukan")
const OLEH = arg("--oleh") ?? "Lepas tautan salah"
if (!MASUKAN) {
  console.error("--masukan <berkas.json> wajib diisi — berhenti.")
  process.exit(1)
}

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
  // Batas sambung bawaan driver 1 dtk. Jaringan ke Hostinger kadang lambat
  // (16 Okt 2026: 3–17 dtk per sambungan) dan skrip gagal sebelum membaca apa pun.
  const sep = envMap.PROD_DATABASE_URL.includes("?") ? "&" : "?"
  process.env.DATABASE_URL = `${envMap.PROD_DATABASE_URL}${sep}connectTimeout=20000`
}

type Baris = { wooId: number; kode: string; namaWeb: string; habiskan?: boolean; catatan?: string }
const masukan = (JSON.parse(readFileSync(MASUKAN, "utf8")) as { lepas: Baris[] }).lepas

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Masukan  : ${MASUKAN} — ${masukan.length} pelepasan\n`)

const ringkas = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase()
type Keadaan = { nama: string; kode: string | null; sku: string | null; stok: string | null; qty: number | null }
type Rencana = Baris & Keadaan
const rencana: Rencana[] = []
const lewat = new Map<string, Baris[]>()
const catat = (alasan: string, b: Baris) => lewat.set(alasan, [...(lewat.get(alasan) ?? []), b])
for (const b of masukan) {
  const [p] = await prisma.$queryRawUnsafe<Keadaan[]>(
    "SELECT name AS nama, accurate_code AS kode, sku, stock_status AS stok, stock_qty AS qty FROM products WHERE woo_id = ?",
    b.wooId,
  )
  if (masukan.filter((x) => x.wooId === b.wooId).length > 1) catat("produk muncul lebih dari sekali di masukan", b)
  else if (!p) catat("produk web tidak ditemukan", b)
  else if (p.kode === null) catat("sudah tidak bertaut (tidak perlu apa-apa)", b)
  else if (p.kode !== b.kode) catat(`produk memegang kode lain (${p.kode}) — tidak disentuh`, b)
  else if (ringkas(p.nama) !== ringkas(b.namaWeb)) catat("nama produk web berubah sejak ditinjau", b)
  else rencana.push({ ...b, ...p, qty: p.qty === null ? null : Number(p.qty) })
}

console.log(`=== RENCANA ===`)
console.log(`Akan dilepas : ${rencana.length}`)
console.log(`Dilewati     : ${masukan.length - rencana.length}`)
for (const [alasan, arr] of lewat) {
  console.log(`  - ${alasan}: ${arr.length}`)
  for (const b of arr) console.log(`      ${b.wooId} ${b.kode} ${b.namaWeb.slice(0, 60)}`)
}
console.log(`\n--- Rincian ---`)
for (const b of rencana) {
  const tambah = [b.sku === b.kode ? "SKU dikosongkan" : null, b.habiskan ? `stok ${b.stok ?? "-"}/${b.qty ?? "-"} -> OUTOFSTOCK/0` : null]
  console.log(`  ${b.wooId} lepas ${b.kode}${tambah.some(Boolean) ? ` (${tambah.filter(Boolean).join(", ")})` : ""} | ${b.namaWeb.slice(0, 60)}`)
}

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/lepas-tautan-${stamp}.sql`
const kutip = (s: string) => `'${s.replace(/'/g, "''")}'`
writeFileSync(
  berkasBackup,
  `-- Pemulihan lepas-tautan-accurate, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Mengembalikan kode, SKU, dan stok HANYA kalau barisnya masih seperti yang ditinggalkan skrip ini.\n\n` +
    rencana
      .map((b) =>
        [
          `UPDATE products SET accurate_code = ${kutip(b.kode)} WHERE woo_id = ${b.wooId} AND accurate_code IS NULL;`,
          b.sku === b.kode ? `UPDATE products SET sku = ${kutip(b.kode)} WHERE woo_id = ${b.wooId} AND sku IS NULL;` : null,
          b.habiskan
            ? `UPDATE products SET stock_status = ${b.stok === null ? "NULL" : kutip(b.stok)}, stock_qty = ${b.qty ?? "NULL"} ` +
              `WHERE woo_id = ${b.wooId} AND stock_status = 'OUTOFSTOCK' AND stock_qty = 0;`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n") +
    "\n",
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let dilepas = 0
let skuDikosongkan = 0
let dihabiskan = 0
const gagal: string[] = []
for (const b of rencana) {
  try {
    const h = await tautkanKode(b.wooId, null, OLEH)
    if (!h.ok) {
      gagal.push(`${b.wooId} ${b.kode}: ${h.alasan}`)
      continue
    }
    dilepas++
    if (b.sku === b.kode) {
      skuDikosongkan += await prisma.$executeRawUnsafe(
        "UPDATE products SET sku = NULL WHERE woo_id = ? AND sku = ? AND accurate_code IS NULL",
        b.wooId,
        b.kode,
      )
    }
    if (b.habiskan) {
      // Perubahan stok dan lognya satu transaksi; syarat diulang di WHERE supaya
      // tautan baru yang dipasang staff di sela-sela tidak ikut dihabiskan.
      const jadi = await prisma.$transaction(async (tx) => {
        const n = await tx.$executeRawUnsafe(
          "UPDATE products SET stock_status = 'OUTOFSTOCK', stock_qty = 0 WHERE woo_id = ? AND accurate_code IS NULL",
          b.wooId,
        )
        if (n !== 1) return false
        await tx.productLog.create({
          data: {
            userName: OLEH,
            productId: b.wooId,
            productName: b.nama,
            action: "BULK_STOCK_STATUS",
            fieldAffected: "stock_status",
            oldValue: `${b.stok ?? "unknown"} (stok ${b.qty ?? "-"})`,
            newValue: "outofstock (stok 0)",
          },
        })
        return true
      })
      if (jadi) dihabiskan++
      else gagal.push(`${b.wooId}: stok tidak diubah — produk berubah sejak diperiksa`)
    }
  } catch (e) {
    gagal.push(`${b.wooId} ${b.kode}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

let terverifikasi = 0
for (const b of rencana) {
  const [r] = await prisma.$queryRawUnsafe<{ kode: string | null; sku: string | null; stok: string | null }[]>(
    "SELECT accurate_code AS kode, sku, stock_status AS stok FROM products WHERE woo_id = ?",
    b.wooId,
  )
  if (r && r.kode === null && (b.sku !== b.kode || r.sku === null) && (!b.habiskan || r.stok === "OUTOFSTOCK")) terverifikasi++
}
console.log(`\n=== HASIL ===`)
console.log(`Dilepas            : ${dilepas} (SKU dikosongkan: ${skuDikosongkan}, stok dihabiskan: ${dihabiskan})`)
console.log(`Terverifikasi di DB: ${terverifikasi} dari ${rencana.length}`)
console.log(`Gagal              : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
await prisma.$disconnect()
