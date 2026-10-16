/**
 * Tandai Habis produk tayang yang TIDAK punya kode Accurate tapi masih berstatus
 * Tersedia warisan WooCommerce.
 *
 * Latar (15 Okt 2026): sinkron stok kini menulis SEMUA produk tertaut, jadi stok
 * produk berkode sudah mengikuti 5 gudang toko. Yang tersisa ±720 produk tayang
 * tanpa kode: sinkron tidak bisa menyentuhnya, dan statusnya masih Tersedia dari
 * zaman WooCommerce. Pemilik ingin beralih dari mode tampilan "Selalu tersedia"
 * ke "Stok asli"; tanpa ini produk-produk itu tetap bisa dipesan padahal tidak
 * ada di stok mana pun yang tercatat. Begitu staff menautkan sebuah produk ke
 * Accurate, sinkron berikutnya mengisi stok aslinya kembali.
 *
 * Yang DIKECUALIKAN:
 *  - Pre-order (ONBACKORDER) — disetel staff dengan sengaja;
 *  - produk digital/lisensi (kategori di KATEGORI_DIGITAL) — dijual tanpa stok
 *    fisik, menandainya Habis memblokir penjualannya;
 *  - variasi dari induk yang punya kode Accurate sendiri (stoknya urusan sinkron).
 * Induk varian tanpa kode yang semua variasinya jadi Habis ikut ditandai Habis
 * (toko membaca status induk dari kolomnya sendiri).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/habiskan-produk-tanpa-kode.mts
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --oleh "Nama"              # nama di log produk
 *
 * Berkas pemulihan ditulis SEBELUM satu baris pun berubah. Toko bisa tertinggal
 * sampai ±1 jam (cache).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const OLEH = arg("--oleh") ?? "Habiskan produk tanpa kode Accurate"
const KATEGORI_DIGITAL = ["ANTIVIRUS", "OFFICE SOFTWARE", "OPERATING SYSTEM"]

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

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

const daftarDigital = KATEGORI_DIGITAL.map((k) => `'${k.replace(/'/g, "''")}'`).join(",")
// Satu sumber syarat — dipakai saat memilih DAN diulang di WHERE saat menulis.
const SYARAT = `p.accurate_code IS NULL AND p.type IN ('SIMPLE','VARIATION') AND p.status = 'PUBLISHED'
   AND (p.type = 'SIMPLE' OR par.status = 'PUBLISHED')
   AND (p.stock_status IS NULL OR p.stock_status = 'INSTOCK')
   AND (p.parent_id IS NULL OR par.accurate_code IS NULL)`
const DIGITAL = `EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id
                  WHERE pc.product_id = COALESCE(par.id, p.id) AND UPPER(c.name) IN (${daftarDigital}))`

type Baris = { id: number; wooId: number; nama: string; tipe: string; stok: string | null; qty: number | null; indukId: number | null }
const ubahBaris = (r: Record<string, unknown>): Baris => ({
  id: Number(r.id),
  wooId: Number(r.wooId),
  nama: String(r.nama),
  tipe: String(r.tipe),
  stok: r.stok === null ? null : String(r.stok),
  qty: r.qty === null ? null : Number(r.qty),
  indukId: r.indukId === null ? null : Number(r.indukId),
})
const KOLOM = `p.id, p.woo_id AS wooId, p.name AS nama, p.type AS tipe, p.stock_status AS stok, p.stock_qty AS qty, p.parent_id AS indukId`
const sasaran = (
  await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${KOLOM} FROM products p LEFT JOIN products par ON par.id = p.parent_id WHERE ${SYARAT} AND NOT ${DIGITAL} ORDER BY p.woo_id`,
  )
).map(ubahBaris)
const digital = (
  await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${KOLOM} FROM products p LEFT JOIN products par ON par.id = p.parent_id WHERE ${SYARAT} AND ${DIGITAL} ORDER BY p.woo_id`,
  )
).map(ubahBaris)

// Induk tanpa kode yang SEMUA variasinya akan Habis sesudah ini.
const akanHabis = new Set(sasaran.map((s) => s.id))
const indukKandidat = [...new Set(sasaran.map((s) => s.indukId).filter((x): x is number => x !== null))]
const indukIkut: Baris[] = []
for (let i = 0; i < indukKandidat.length; i += 500) {
  const potong = indukKandidat.slice(i, i + 500)
  const induk = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT p.id, p.woo_id AS wooId, p.name AS nama, p.type AS tipe, p.stock_status AS stok, p.stock_qty AS qty, NULL AS indukId
       FROM products p WHERE p.id IN (${potong.join(",")}) AND p.accurate_code IS NULL
        AND (p.stock_status IS NULL OR p.stock_status <> 'OUTOFSTOCK')`,
  )
  const variasi = await prisma.$queryRawUnsafe<{ id: number; indukId: number; stok: string | null; status: string }[]>(
    `SELECT id, parent_id AS indukId, stock_status AS stok, status FROM products WHERE parent_id IN (${potong.join(",")})`,
  )
  for (const ind of induk.map(ubahBaris)) {
    const masihJual = variasi.some(
      (v) => Number(v.indukId) === ind.id && v.status === "PUBLISHED" && v.stok !== "OUTOFSTOCK" && !akanHabis.has(Number(v.id)),
    )
    if (!masihJual) indukIkut.push(ind)
  }
}

const per = (arr: Baris[]) => arr.reduce<Record<string, number>>((a, b) => ((a[`${b.tipe}/${b.stok ?? "NULL"}`] = (a[`${b.tipe}/${b.stok ?? "NULL"}`] ?? 0) + 1), a), {})
console.log(`=== RENCANA ===`)
console.log(`Produk ditandai Habis      : ${sasaran.length}  ${JSON.stringify(per(sasaran))}`)
console.log(`Induk varian ikut Habis    : ${indukIkut.length}`)
console.log(`Dikecualikan (digital)     : ${digital.length}`)
for (const d of digital) console.log(`    ${d.wooId} ${d.nama.slice(0, 80)}`)
console.log(`\n--- Contoh 15 yang ditandai Habis ---`)
for (const s of sasaran.slice(0, 15)) console.log(`  ${s.wooId} ${s.tipe} ${s.stok ?? "NULL"}/${s.qty ?? "-"} | ${s.nama.slice(0, 70)}`)

if (!TULIS || sasaran.length === 0) {
  console.log(`\nUji kering selesai — tidak ada yang ditulis.${sasaran.length ? " Tambahkan --tulis untuk menulis." : ""}`)
  await prisma.$disconnect()
  process.exit(0)
}

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/habiskan-produk-tanpa-kode-${stamp}.sql`
const nilai = (s: string | null) => (s === null ? "NULL" : `'${s}'`)
writeFileSync(
  berkasBackup,
  `-- Pemulihan habiskan-produk-tanpa-kode, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Mengembalikan status & angka stok HANYA kalau produk masih Habis/0 dan tetap tanpa kode Accurate.\n\n` +
    [...sasaran, ...indukIkut]
      .map(
        (b) =>
          `UPDATE products SET stock_status = ${nilai(b.stok)}, stock_qty = ${b.qty ?? "NULL"} WHERE woo_id = ${b.wooId} ` +
          `AND stock_status = 'OUTOFSTOCK' AND accurate_code IS NULL${b.tipe === "VARIABLE" ? "" : " AND stock_qty = 0"};`,
      )
      .join("\n") +
    "\n",
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let ditulis = 0
const gagal: string[] = []
const tulisPotong = async (potong: Baris[], induk: boolean) => {
  // Per potongan: kunci baris yang MASIH memenuhi syarat, ubah, lalu catat — satu
  // transaksi, supaya produk yang di sela-sela ditautkan staff tidak tersentuh dan
  // tidak tercatat.
  const n = await prisma.$transaction(
    async (tx) => {
      const ids = potong.map((b) => b.id).join(",")
      const syaratTulis = induk
        ? `p.id IN (${ids}) AND p.accurate_code IS NULL AND (p.stock_status IS NULL OR p.stock_status <> 'OUTOFSTOCK')`
        : `p.id IN (${ids}) AND ${SYARAT}`
      const masih = await tx.$queryRawUnsafe<{ id: number }[]>(
        `SELECT p.id FROM products p LEFT JOIN products par ON par.id = p.parent_id WHERE ${syaratTulis} FOR UPDATE`,
      )
      const idMasih = new Set(masih.map((m) => Number(m.id)))
      if (idMasih.size === 0) return 0
      await tx.$executeRawUnsafe(
        induk
          ? `UPDATE products SET stock_status = 'OUTOFSTOCK' WHERE id IN (${[...idMasih].join(",")})`
          : `UPDATE products SET stock_status = 'OUTOFSTOCK', stock_qty = 0 WHERE id IN (${[...idMasih].join(",")})`,
      )
      await tx.productLog.createMany({
        data: potong
          .filter((b) => idMasih.has(b.id))
          .map((b) => ({
            userName: OLEH,
            productId: b.wooId,
            productName: b.nama,
            action: "BULK_STOCK_STATUS",
            fieldAffected: "stock_status",
            oldValue: `${b.stok ?? "unknown"} (stok ${b.qty ?? "-"})`,
            newValue: induk ? "outofstock (semua variasi habis)" : "outofstock (stok 0) — tanpa kode Accurate",
          })),
      })
      return idMasih.size
    },
    { timeout: 60000, maxWait: 15000 },
  )
  ditulis += n
  if (n < potong.length) gagal.push(`${potong.length - n} produk berubah sejak diperiksa — dilewati`)
}
for (let i = 0; i < sasaran.length; i += 200) {
  try {
    await tulisPotong(sasaran.slice(i, i + 200), false)
  } catch (e) {
    gagal.push(`potongan ${i}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
for (let i = 0; i < indukIkut.length; i += 200) {
  try {
    await tulisPotong(indukIkut.slice(i, i + 200), true)
  } catch (e) {
    gagal.push(`induk potongan ${i}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

const [sisa] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
  `SELECT COUNT(*) AS n FROM products p LEFT JOIN products par ON par.id = p.parent_id WHERE ${SYARAT} AND NOT ${DIGITAL}`,
)
console.log(`\n=== HASIL ===`)
console.log(`Ditandai Habis           : ${ditulis} (produk ${sasaran.length} + induk ${indukIkut.length} direncanakan)`)
console.log(`Sisa yang memenuhi syarat: ${Number(sisa?.n ?? 0)} (harus 0)`)
console.log(`Gagal / dilewati         : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
await prisma.$disconnect()
