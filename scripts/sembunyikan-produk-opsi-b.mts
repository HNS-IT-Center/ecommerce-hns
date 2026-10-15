/**
 * Sembunyikan produk web tayang yang TIDAK punya barang Accurate (opsi B,
 * 13 Okt 2026) — hanya yang diputuskan SEMBUNYIKAN oleh user di lembar
 * `opsi-b-produk-tanpa-accurate-*.xlsx`.
 *
 *   python backup/cocokkan-tautan/baca_opsi_b.py "<xlsx>"      # -> keputusan-opsi-b.json
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/sembunyikan-produk-opsi-b.mts
 *   ... --tulis                    # tulis ke database lokal
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --masukan <berkas.json>    # bawaan: backup/cocokkan-tautan/keputusan-opsi-b.json
 *   ... --oleh "Nama"              # nama di log produk
 *
 * Arti "sembunyikan" (keputusan user 13 Okt 2026):
 *   - produk biasa (SIMPLE)  -> status DRAFT: hilang dari toko.
 *   - varian (VARIATION)     -> status DRAFT + stok HABIS. Toko TIDAK memeriksa
 *     status varian (`fetchProductVariations` mengambil semua varian), jadi
 *     DRAFT saja tidak menyembunyikan apa pun — varian itu tetap bisa dibeli.
 *     Stok HABIS yang membuatnya tak bisa dimasukkan keranjang ("Varian ini
 *     sedang habis"); DRAFT mencatat maksudnya untuk panel admin.
 *   - induk VARIABLE -> ikut DRAFT bila SEMUA variasinya yang masih tayang
 *     disembunyikan, supaya tidak tersisa halaman produk tanpa satu pun
 *     pilihan yang bisa dibeli.
 *
 * Setiap baris diperiksa ulang terhadap database TUJUAN. Dilewati bila produk
 * tidak ada, namanya berubah sejak lembar dibuat, sudah tertaut ke Accurate
 * (berarti barangnya ada — jangan disembunyikan), atau sudah tidak tayang.
 *
 * Tercatat di product_logs seperti tombol status massal di panel
 * (BULK_STATUS, BULK_STOCK_STATUS). Bawaannya UJI KERING; sebelum menulis,
 * berkas pemulihan disimpan di `backup/sembunyikan-opsi-b-<waktu>.sql`. Toko
 * menyimpan data produk di cache sampai 1 jam — perubahan tampil paling
 * lambat selama itu.
 *
 * Aman diulang: yang sudah tidak tayang tidak lagi memenuhi syarat.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const MASUKAN = arg("--masukan") ?? "backup/cocokkan-tautan/keputusan-opsi-b.json"
const OLEH = arg("--oleh") ?? "Opsi B — tanpa barang Accurate"

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

type Baris = { wooId: number; nama: string; tipe: string; golongan: string }
const isi = JSON.parse(readFileSync(MASUKAN, "utf8")) as { sembunyikan?: Baris[]; takDikenal?: unknown[] }
const masukan = isi.sembunyikan ?? []

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Masukan  : ${MASUKAN} — ${masukan.length} produk SEMBUNYIKAN`)
if (isi.takDikenal?.length) console.log(`           (${isi.takDikenal.length} baris berisi nilai tak dikenal sudah dibuang oleh pembaca — lihat keluarannya)`)
console.log()

// --- Pemeriksaan ulang -------------------------------------------------------
type Tujuan = {
  wooId: number
  nama: string
  tipe: string
  status: string
  stok: string | null
  kode: string | null
  parentId: number | null
  indukWoo: number | null
  indukStatus: string | null
}
const daftar = <T,>(xs: T[]) => xs.map(() => "?").join(",") || "NULL"
const angka = (v: unknown) => (v == null ? null : Number(v))
const wooIds = [...new Set(masukan.map((b) => b.wooId))]
const produk = new Map<number, Tujuan>()
for (let i = 0; i < wooIds.length; i += 500) {
  const potong = wooIds.slice(i, i + 500)
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT p.woo_id AS wooId, p.name AS nama, p.type AS tipe, p.status, p.stock_status AS stok, p.accurate_code AS kode,
            p.parent_id AS parentId, par.woo_id AS indukWoo, par.status AS indukStatus
       FROM products p LEFT JOIN products par ON par.id = p.parent_id
      WHERE p.woo_id IN (${daftar(potong)})`,
    ...potong,
  )
  for (const r of rows) {
    produk.set(Number(r.wooId), {
      wooId: Number(r.wooId),
      nama: String(r.nama),
      tipe: String(r.tipe),
      status: String(r.status),
      stok: r.stok == null ? null : String(r.stok),
      kode: r.kode == null ? null : String(r.kode),
      parentId: angka(r.parentId),
      indukWoo: angka(r.indukWoo),
      indukStatus: r.indukStatus == null ? null : String(r.indukStatus),
    })
  }
}

const ringkas = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase()
const hitung = new Map<number, number>()
for (const b of masukan) hitung.set(b.wooId, (hitung.get(b.wooId) ?? 0) + 1)
const rencana: Tujuan[] = []
const lewat = new Map<string, Baris[]>()
const catat = (alasan: string, b: Baris) => lewat.set(alasan, [...(lewat.get(alasan) ?? []), b])
for (const b of masukan) {
  const p = produk.get(b.wooId)
  if (hitung.get(b.wooId)! > 1) catat("produk muncul lebih dari sekali di masukan", b)
  else if (!p) catat("produk web tidak ditemukan", b)
  else if (ringkas(p.nama) !== ringkas(b.nama)) catat("nama produk web berubah sejak lembar dibuat", b)
  else if (p.kode) catat("produk sudah tertaut ke Accurate — barangnya ada, tidak disembunyikan", b)
  else if (p.tipe !== "SIMPLE" && p.tipe !== "VARIATION") catat(`tipe produk ${p.tipe} — hanya SIMPLE/VARIATION`, b)
  else if (p.status !== "PUBLISHED") catat("sudah tidak tayang (tidak perlu apa-apa)", b)
  else if (p.tipe === "VARIATION" && p.indukStatus !== "PUBLISHED") catat("induknya sudah tidak tayang (tidak perlu apa-apa)", b)
  else rencana.push(p)
}

// Induk yang SEMUA variasi tayangnya ikut disembunyikan -> induk ikut DRAFT.
const disembunyikan = new Set(rencana.map((p) => p.wooId))
const indukIds = [...new Set(rencana.filter((p) => p.tipe === "VARIATION").map((p) => p.parentId!))]
type Induk = { wooId: number; nama: string; status: string }
const indukIkut: Induk[] = []
for (let i = 0; i < indukIds.length; i += 300) {
  const potong = indukIds.slice(i, i + 300)
  const anak = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT parent_id AS pid, woo_id AS w, status FROM products WHERE parent_id IN (${daftar(potong)})`,
    ...potong,
  )
  const induk = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, woo_id AS w, name AS nama, status FROM products WHERE id IN (${daftar(potong)})`,
    ...potong,
  )
  for (const ind of induk) {
    const sisa = anak.filter((a) => Number(a.pid) === Number(ind.id) && a.status === "PUBLISHED" && !disembunyikan.has(Number(a.w)))
    if (sisa.length === 0 && ind.status === "PUBLISHED") {
      indukIkut.push({ wooId: Number(ind.w), nama: String(ind.nama), status: String(ind.status) })
    }
  }
}

const simple = rencana.filter((p) => p.tipe === "SIMPLE")
const variasi = rencana.filter((p) => p.tipe === "VARIATION")
console.log("=== RENCANA ===")
console.log(`Produk biasa -> DRAFT            : ${simple.length}`)
console.log(`Varian -> DRAFT + stok HABIS     : ${variasi.length}`)
console.log(`Induk ikut DRAFT (semua variannya disembunyikan): ${indukIkut.length}`)
console.log(`  dari semuanya, yang di web masih "ada stok": ${rencana.filter((p) => p.stok === "INSTOCK").length}`)
console.log(`Dilewati                         : ${masukan.length - rencana.length}`)
for (const [alasan, arr] of lewat) {
  console.log(`  - ${alasan}: ${arr.length}`)
  for (const b of arr.slice(0, 3)) console.log(`      ${b.wooId} ${b.nama.slice(0, 70)}`)
}
console.log("\n--- Contoh ---")
for (const p of [...simple.slice(0, 4), ...variasi.slice(0, 4)]) console.log(`  [${p.tipe}] ${p.wooId} ${p.nama.slice(0, 80)}`)
for (const p of indukIkut.slice(0, 5)) console.log(`  [INDUK] ${p.wooId} ${p.nama.slice(0, 80)}`)

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

// --- Berkas pemulihan DITULIS DULU -------------------------------------------
mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/sembunyikan-opsi-b-${stamp}.sql`
const kutip = (s: string) => `'${s.replace(/'/g, "''")}'`
writeFileSync(
  berkasBackup,
  `-- Pemulihan sembunyikan-produk-opsi-b, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Menayangkan lagi HANYA yang masih dalam keadaan yang dibuat skrip ini (DRAFT /\n` +
    `-- HABIS). Yang sesudahnya diubah staff tidak disentuh.\n\n` +
    [
      ...rencana.map(
        (p) =>
          `UPDATE products SET status = 'PUBLISHED' WHERE woo_id = ${p.wooId} AND status = 'DRAFT';` +
          (p.tipe === "VARIATION" && p.stok !== "OUTOFSTOCK"
            ? `\nUPDATE products SET stock_status = ${p.stok == null ? "NULL" : kutip(p.stok)} WHERE woo_id = ${p.wooId} AND stock_status = 'OUTOFSTOCK';`
            : ""),
      ),
      ...indukIkut.map((p) => `UPDATE products SET status = 'PUBLISHED' WHERE woo_id = ${p.wooId} AND status = 'DRAFT';`),
    ].join("\n") +
    "\n",
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let berhasil = 0
const gagal: string[] = []
type Tulis = { wooId: number; nama: string; tipe: string; status: string; stok: string | null }
const antrean: Tulis[] = [...rencana, ...indukIkut.map((x) => ({ ...x, tipe: "VARIABLE", stok: null }))]
for (const [i, p] of antrean.entries()) {
  try {
    const varian = p.tipe === "VARIATION"
    const logData = (kolom: string, lama: string | null, baru: string) => ({
      userName: OLEH,
      productId: p.wooId,
      productName: p.nama,
      action: `BULK_${kolom.toUpperCase()}`,
      fieldAffected: kolom,
      oldValue: lama ?? "unknown",
      newValue: baru,
    })
    // Perubahan dan lognya satu transaksi. Syarat diulang di WHERE: kalau staff
    // menautkan atau mengubah status di antara pemeriksaan dan penulisan,
    // barisnya tidak tersentuh dan lognya tidak dibuat.
    const jadi = await prisma.$transaction(
      async (tx) => {
        const ubah = await tx.product.updateMany({
          where: { wooId: p.wooId, status: "PUBLISHED", ...(p.tipe === "VARIABLE" ? {} : { accurateCode: null }) },
          data: varian ? { status: "DRAFT", stockStatus: "OUTOFSTOCK" } : { status: "DRAFT" },
        })
        if (ubah.count !== 1) return false
        await tx.productLog.create({ data: logData("status", p.status, "draft") })
        if (varian && p.stok !== "OUTOFSTOCK") await tx.productLog.create({ data: logData("stock_status", p.stok, "outofstock") })
        return true
      },
      { timeout: 30000, maxWait: 15000 },
    )
    if (jadi) berhasil++
    else gagal.push(`${p.wooId}: berubah sejak diperiksa — dilewati`)
  } catch (e) {
    gagal.push(`${p.wooId}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1} ...`)
}

// --- Verifikasi --------------------------------------------------------------
const semua = [...rencana.map((p) => p.wooId), ...indukIkut.map((p) => p.wooId)]
let terverifikasi = 0
for (let i = 0; i < semua.length; i += 500) {
  const potong = semua.slice(i, i + 500)
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM products WHERE status = 'DRAFT' AND woo_id IN (${daftar(potong)})`,
    ...potong,
  )
  terverifikasi += Number(rows[0]!.n)
}
console.log("\n=== HASIL ===")
console.log(`Berhasil disembunyikan : ${berhasil} dari ${semua.length} (termasuk ${indukIkut.length} induk)`)
console.log(`Terverifikasi DRAFT    : ${terverifikasi}`)
console.log(`Gagal / dilewati       : ${gagal.length}`)
for (const g of gagal.slice(0, 20)) console.log(`  ${g}`)
console.log(`\nToko menyimpan cache sampai 1 jam — produk hilang dari toko paling lambat selama itu.`)
console.log(`Membatalkan: jalankan ${berkasBackup} ke database yang sama.`)
await prisma.$disconnect()
