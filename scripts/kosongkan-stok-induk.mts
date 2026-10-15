/**
 * Kosongkan angka stok (stock_qty) produk INDUK varian yang tertinggal dari
 * sinkron Accurate lama.
 *
 * Latar (15 Okt 2026): pecah-varian-laptop/-warna memindah kode Accurate dari
 * produk ke variasinya dan menjadikan produknya induk VARIABLE. Angka stok yang
 * pernah ditulis sinkron ke produk itu tertinggal — sinkron tidak lagi
 * menyentuhnya karena induk tak berkode. Sebagian dihitung dengan aturan gudang
 * lama (GRIYA & GUDANG BATAM ikut): Acer Aspire Lite R8JN/R1QH induk 93, padahal
 * variasinya berjumlah 8. Induk varian lain memang tidak menyimpan angka sendiri
 * (stock_qty kosong); status Tersedia/Habis induk tetap diselaraskan sinkron dari
 * variasinya, jadi yang dikosongkan hanya angkanya.
 *
 * Sasaran dipilih dari database, bukan daftar: induk VARIABLE, tanpa kode
 * Accurate, dan pernah disinkron (stock_synced_at terisi). stock_synced_at ikut
 * dikosongkan — penanda itu milik produk yang stoknya ditulis sinkron.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/kosongkan-stok-induk.mts
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --oleh "Nama"              # nama di log produk
 *
 * Berkas pemulihan ditulis SEBELUM satu baris pun berubah.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const OLEH = arg("--oleh") ?? "Kosongkan stok induk"

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

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

type Induk = { wooId: number; nama: string; qty: number | null; disinkron: Date; jumlahVariasi: number | null; nVariasi: number }
const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
  `SELECT p.woo_id AS wooId, p.name AS nama, p.stock_qty AS qty, p.stock_synced_at AS disinkron,
          (SELECT SUM(v.stock_qty) FROM products v WHERE v.parent_id = p.id) AS jumlahVariasi,
          (SELECT COUNT(*) FROM products v WHERE v.parent_id = p.id) AS nVariasi
     FROM products p
    WHERE p.type = 'VARIABLE' AND p.accurate_code IS NULL AND p.stock_synced_at IS NOT NULL
    ORDER BY p.stock_qty DESC`,
)
const sasaran: Induk[] = rows.map((r) => ({
  wooId: Number(r.wooId),
  nama: String(r.nama),
  qty: r.qty === null ? null : Number(r.qty),
  disinkron: r.disinkron as Date,
  jumlahVariasi: r.jumlahVariasi === null ? null : Number(r.jumlahVariasi),
  nVariasi: Number(r.nVariasi),
}))

console.log(`=== RENCANA ===`)
console.log(`Induk yang angka stoknya dikosongkan: ${sasaran.length}`)
for (const s of sasaran)
  console.log(`  ${s.wooId} stok induk ${s.qty ?? "-"} (jumlah ${s.nVariasi} variasi: ${s.jumlahVariasi ?? "-"}) | ${s.nama.slice(0, 60)}`)

if (!TULIS || sasaran.length === 0) {
  console.log(`\nUji kering selesai — tidak ada yang ditulis.${sasaran.length ? " Tambahkan --tulis untuk menulis." : ""}`)
  await prisma.$disconnect()
  process.exit(0)
}

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/kosongkan-stok-induk-${stamp}.sql`
const waktu = (d: Date) => `'${d.toISOString().replace("T", " ").replace("Z", "")}'`
writeFileSync(
  berkasBackup,
  `-- Pemulihan kosongkan-stok-induk, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Mengembalikan angka stok & stock_synced_at HANYA kalau keduanya masih kosong (belum diisi ulang sesudahnya).\n\n` +
    sasaran
      .map(
        (s) =>
          `UPDATE products SET stock_qty = ${s.qty ?? "NULL"}, stock_synced_at = ${waktu(s.disinkron)} ` +
          `WHERE woo_id = ${s.wooId} AND stock_qty IS NULL AND stock_synced_at IS NULL;`,
      )
      .join("\n") +
    "\n",
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let berhasil = 0
const gagal: string[] = []
for (const s of sasaran) {
  try {
    // Perubahan dan lognya satu transaksi; syarat diulang di WHERE supaya induk
    // yang di sela-sela diberi kode Accurate (stoknya jadi milik sinkron) tidak tersentuh.
    const jadi = await prisma.$transaction(async (tx) => {
      const n = await tx.$executeRawUnsafe(
        `UPDATE products SET stock_qty = NULL, stock_synced_at = NULL
          WHERE woo_id = ? AND type = 'VARIABLE' AND accurate_code IS NULL AND stock_synced_at IS NOT NULL`,
        s.wooId,
      )
      if (n !== 1) return false
      if (s.qty !== null) {
        await tx.productLog.create({
          data: {
            userName: OLEH,
            productId: s.wooId,
            productName: s.nama,
            action: "BULK_STOCK_STATUS",
            fieldAffected: "stock_qty",
            oldValue: String(s.qty),
            newValue: "kosong (induk varian — stok ada di variasi)",
          },
        })
      }
      return true
    })
    if (jadi) berhasil++
    else gagal.push(`${s.wooId}: berubah sejak diperiksa — dilewati`)
  } catch (e) {
    gagal.push(`${s.wooId}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const [sisa] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
  "SELECT COUNT(*) AS n FROM products WHERE type = 'VARIABLE' AND accurate_code IS NULL AND stock_synced_at IS NOT NULL",
)
console.log(`\n=== HASIL ===`)
console.log(`Dikosongkan        : ${berhasil} dari ${sasaran.length}`)
console.log(`Sisa induk sejenis : ${Number(sisa?.n ?? 0)} (harus 0)`)
console.log(`Gagal              : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
await prisma.$disconnect()
