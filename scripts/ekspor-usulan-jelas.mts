/**
 * Ekspor antrean "Usulan Pasangan" tingkat JELAS — persis seperti di halaman
 * admin (/admin/harga-accurate?tab=usulan) — ke berkas JSON, untuk dibuatkan
 * lembar kerja periksa. BACA SAJA: tidak ada satu baris pun yang ditulis.
 *
 * Latar (13 Okt 2026): set A+B pencocok sudah diterapkan; sisa "Jelas" di admin
 * adalah barang yang DITOLAK pencocok (uji kunci: ±89% kandidat teratasnya
 * benar). Pemilik memilih memeriksanya lewat lembar kerja, bukan menautkan
 * semuanya. Rumus tingkatnya sama dengan listUsulanPasangan
 * (lib/api/accurate/usulan-pasangan.ts): peringkatKandidat + tingkatKeyakinan.
 *
 * Tidak memakai tabel/kolom migrasi F2 (accurate_items, stock_synced_at) —
 * aman dijalankan ke produksi sebelum F2 di-deploy. Stok dari kolom
 * "Stok Sistem" accurate_products, sama dengan yang tampil di halaman admin.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/ekspor-usulan-jelas.mts              # lokal
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/ekspor-usulan-jelas.mts --produksi  # produksi
 *
 * Keluaran: backup/cocokkan-tautan/ekspor-jelas.json (di-gitignore).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const PRODUKSI = process.argv.includes("--produksi")
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
const { bangunIndeks, peringkatKandidat, tingkatKeyakinan } = await import("../src/lib/api/accurate/pencocokan-nama.ts")
const prisma = getPrisma()
const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI (baca saja)" : ""}`)

const produkRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
  `SELECT p.woo_id AS wooId, p.name AS nama, p.type AS tipe, p.status, par.status AS statusInduk,
          p.accurate_code AS kode, par.woo_id AS induk
     FROM products p LEFT JOIN products par ON par.id = p.parent_id
    WHERE p.name IS NOT NULL`,
)
const produk = produkRows.map((r) => ({
  wooId: Number(r.wooId),
  nama: String(r.nama),
  tipe: String(r.tipe),
  status: String(r.status),
  statusInduk: r.statusInduk == null ? null : String(r.statusInduk),
  kode: r.kode == null ? null : String(r.kode),
  induk: r.induk == null ? null : Number(r.induk),
}))
const perWoo = new Map(produk.map((p) => [p.wooId, p]))
const katalog = bangunIndeks(produk.map((p) => ({ wooId: p.wooId, nama: p.nama })))

// Antrean persis seperti listUsulanPasangan.
const antrean = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
  `SELECT a.\`Kode Accurate\` AS kode, a.\`NAMA BARANG\` AS nama, a.\`KATEGORI\` AS kategori,
          a.\`NAMA BRAND\` AS brand, a.\`Stok Sistem\` AS stok
     FROM accurate_products a
     LEFT JOIN products p          ON p.accurate_code = a.\`Kode Accurate\`
     LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
    WHERE p.woo_id IS NULL
      AND ig.kode_accurate IS NULL
      AND (a.\`STATUS\` IS NULL OR a.\`STATUS\` <> 'YA')
      AND a.\`NAMA BARANG\` IS NOT NULL
      AND a.\`NAMA BARANG\` <> ''`,
)

// Kode yang sudah ditandai "tidak dijual di web" — supaya lembar lanjutan bisa
// membedakan baris yang sudah diputuskan dari yang memang masih terbuka.
const abaikan = (
  await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT kode_accurate AS kode FROM accurate_ignored`)
).map((r) => String(r.kode))

const rekap = { tinggi: 0, sedang: 0, rendah: 0 }
const jelas: unknown[] = []
for (const a of antrean) {
  const kandidat = peringkatKandidat(String(a.nama), katalog, 3)
  const t = tingkatKeyakinan(kandidat)
  rekap[t]++
  if (t !== "tinggi") continue
  jelas.push({
    kode: String(a.kode),
    nama: String(a.nama),
    kategori: a.kategori == null ? null : String(a.kategori),
    brand: a.brand == null ? null : String(a.brand),
    stok: a.stok == null || a.stok === "" ? null : Number(a.stok) || 0,
    kandidat: kandidat.map((k) => ({ ...perWoo.get(k.wooId)!, alasan: k.alasan })),
  })
}

mkdirSync("backup/cocokkan-tautan", { recursive: true })
const keluar = "backup/cocokkan-tautan/ekspor-jelas.json"
writeFileSync(
  keluar,
  JSON.stringify({ dibuat: new Date().toISOString(), database: `${url.pathname.slice(1)} @ ${url.hostname}`, rekap, jelas, produk, abaikan }),
)
console.log(`Belum tertaut : ${antrean.length}`)
console.log(`  Jelas ${rekap.tinggi} · Perlu dilihat ${rekap.sedang} · Meragukan ${rekap.rendah}  (harus sama dengan lencana di halaman admin)`)
console.log(`Tersimpan     : ${keluar} — tidak ada yang ditulis ke database.`)
await prisma.$disconnect()
