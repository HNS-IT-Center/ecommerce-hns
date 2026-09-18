/**
 * Laporan kemajuan penautan Accurate ↔ katalog web, dipecah per kategori.
 *
 * HANYA MEMBACA. Tidak ada satu pun perintah tulis di berkas ini, jadi aman
 * dijalankan kapan saja — termasuk berulang kali untuk melihat kemajuan.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/laporan-tautan-per-kategori.mts
 *
 *   # satu kategori saja, beserta daftar barang yang perlu ditautkan
 *   npx tsx ... scripts/laporan-tautan-per-kategori.mts --kategori "LAPTOP"
 *
 *   # berapa baris contoh yang ditampilkan (bawaan 15)
 *   npx tsx ... scripts/laporan-tautan-per-kategori.mts --kategori "LAPTOP" --contoh 40
 *
 * Kategori yang dipakai adalah **kategori Accurate** (`accurate_products`.
 * `KATEGORI`), bukan kategori web. Alasannya: pekerjaan yang dihitung di sini
 * adalah "barang Accurate mana yang belum punya produk web", jadi yang masuk
 * akal dipakai memecahnya adalah taksonomi sisi Accurate.
 *
 * Kolom "Perlu" adalah antrean kerja yang sesungguhnya:
 *   barang AKTIF, BELUM tertaut, dan BELUM ditandai "tidak dijual di web".
 * Barang tidak aktif tidak dihitung — ia tidak akan pernah perlu ditautkan.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync } from "node:fs"

const argv = process.argv
const ambil = (bendera: string): string | null => {
  const i = argv.indexOf(bendera)
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : null
}
const KATEGORI = ambil("--kategori")
const CONTOH = Number(ambil("--contoh") ?? 15) || 15

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const namaDb = new URL(cocok[1]!.replace(/^mysql:/, "http:")).pathname.slice(1)

const { getPrisma } = await import("../src/lib/prisma/client")
/**
 * Pembaca harga milik aplikasi, bukan buatan sendiri.
 *
 * Penting: sebagian nilai `SP` tersimpan berformat Indonesia ("8.900.000").
 * `Number("8.900.000")` menghasilkan NaN, sedangkan parser ini membuang
 * pemisah ribuan lebih dulu sehingga terbaca 8.900.000. Memakai pembacaan
 * sendiri di sini berarti laporan menampilkan angka yang berbeda dari yang
 * dilihat staff di panel.
 */
const { parseHargaAccurate } = await import("../src/lib/api/accurate/stock-db")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${namaDb}`)
console.log(`Mode     : BACA SAJA\n`)

/**
 * Satu kueri untuk seluruh rekap, bukan satu per kategori.
 *
 * Kuota koneksi MariaDB Hostinger 500/jam dan pola satu-kueri-per-baris pernah
 * menghabiskannya sendirian. Dengan ~40 kategori, memecahnya berarti 40
 * perjalanan untuk data yang muat dalam satu.
 */
type Rekap = {
  kategori: string | null
  total: bigint
  aktif: bigint
  tertaut: bigint
  diabaikan: bigint
  perlu: bigint
  berharga: bigint
  /**
   * Perlu ditautkan DAN sudah punya harga jual di Accurate.
   *
   * Ini antrean yang paling berharga dikerjakan lebih dulu: menautkan barang
   * yang belum punya SP tidak menghasilkan apa-apa untuk sinkronisasi harga —
   * tidak ada angka yang bisa mengalir. Barang seperti itu tetap perlu
   * ditautkan suatu saat, tapi bukan yang pertama.
   */
  perluBerharga: bigint
}

const rekap = await q<Rekap>(
  `SELECT
     a.\`KATEGORI\` AS kategori,
     COUNT(*) AS total,
     SUM(CASE WHEN a.\`STATUS\` <> 'YA' OR a.\`STATUS\` IS NULL THEN 1 ELSE 0 END) AS aktif,
     SUM(CASE WHEN p.woo_id IS NOT NULL THEN 1 ELSE 0 END) AS tertaut,
     SUM(CASE WHEN ig.kode_accurate IS NOT NULL THEN 1 ELSE 0 END) AS diabaikan,
     SUM(CASE WHEN (a.\`STATUS\` <> 'YA' OR a.\`STATUS\` IS NULL)
                AND p.woo_id IS NULL
                AND ig.kode_accurate IS NULL THEN 1 ELSE 0 END) AS perlu,
     SUM(CASE WHEN a.\`SP\` IS NOT NULL AND a.\`SP\` <> ''
                AND CAST(a.\`SP\` AS DECIMAL(18,0)) > 0 THEN 1 ELSE 0 END) AS berharga,
     SUM(CASE WHEN (a.\`STATUS\` <> 'YA' OR a.\`STATUS\` IS NULL)
                AND p.woo_id IS NULL
                AND ig.kode_accurate IS NULL
                AND a.\`SP\` IS NOT NULL AND a.\`SP\` <> ''
                AND CAST(a.\`SP\` AS DECIMAL(18,0)) > 0 THEN 1 ELSE 0 END) AS perluBerharga
   FROM accurate_products a
   LEFT JOIN products p ON p.accurate_code = a.\`Kode Accurate\`
   LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
   GROUP BY a.\`KATEGORI\`
   ORDER BY perluBerharga DESC, perlu DESC`,
)

const angka = (v: bigint | number) => Number(v).toLocaleString("id-ID")
const pad = (v: bigint | number, l: number) => angka(v).padStart(l)

if (!KATEGORI) {
  console.log("=== ANTREAN KERJA PER KATEGORI ===")
  console.log("Perlu       = barang AKTIF, belum tertaut, belum diabaikan")
  console.log("Perlu+Harga = di antaranya yang SUDAH punya harga jual di Accurate")
  console.log("              (menautkan yang tanpa harga belum menghasilkan apa-apa)\n")
  console.log("  KATEGORI                         Total   Aktif  Tertaut  Diabaikan    Perlu  Perlu+Harga")
  console.log("  " + "-".repeat(91))

  let jTotal = 0, jAktif = 0, jTertaut = 0, jAbai = 0, jPerlu = 0, jPH = 0
  for (const r of rekap) {
    const nama = (r.kategori ?? "(tanpa kategori)").slice(0, 30)
    console.log(
      `  ${nama.padEnd(30)} ${pad(r.total, 6)}  ${pad(r.aktif, 6)}  ${pad(r.tertaut, 7)}  ${pad(r.diabaikan, 9)}  ${pad(r.perlu, 7)}  ${pad(r.perluBerharga, 11)}`,
    )
    jTotal += Number(r.total); jAktif += Number(r.aktif); jTertaut += Number(r.tertaut)
    jAbai += Number(r.diabaikan); jPerlu += Number(r.perlu); jPH += Number(r.perluBerharga)
  }
  console.log("  " + "-".repeat(91))
  console.log(
    `  ${"JUMLAH".padEnd(30)} ${pad(jTotal, 6)}  ${pad(jAktif, 6)}  ${pad(jTertaut, 7)}  ${pad(jAbai, 9)}  ${pad(jPerlu, 7)}  ${pad(jPH, 11)}`,
  )

  console.log("\n=== SARAN URUTAN PENGERJAAN ===")
  console.log("Dahulukan yang barangnya sudah punya harga — itu yang langsung berbuah\n")
  console.log("saat disinkronkan. Kategori kecil lebih dulu supaya ada yang benar-benar")
  console.log("SELESAI, bukan banyak yang setengah jalan.\n")
  const layak = [...rekap].filter((r) => Number(r.perluBerharga) > 0)
  const kecilDulu = [...layak].sort((a, b) => Number(a.perluBerharga) - Number(b.perluBerharga))
  console.log("  -- paling cepat selesai --")
  for (const r of kecilDulu.slice(0, 6)) {
    console.log(`  ${angka(r.perluBerharga).padStart(5)} barang berharga  <-  ${r.kategori ?? "(tanpa kategori)"}`)
  }
  console.log("\n  -- paling banyak isinya --")
  for (const r of layak.slice(0, 6)) {
    console.log(`  ${angka(r.perluBerharga).padStart(5)} barang berharga  <-  ${r.kategori ?? "(tanpa kategori)"}`)
  }
  console.log("\nUntuk melihat isi satu kategori:")
  console.log(`  ... scripts/laporan-tautan-per-kategori.mts --kategori "${kecilDulu[0]?.kategori ?? "NAMA"}"`)
} else {
  const baris = rekap.find((r) => (r.kategori ?? "") === KATEGORI)
  if (!baris) {
    console.log(`Kategori "${KATEGORI}" tidak ditemukan. Daftar yang ada:`)
    for (const r of rekap.slice(0, 40)) console.log(`  ${r.kategori ?? "(tanpa kategori)"}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`=== ${KATEGORI} ===`)
  console.log(`  total barang   : ${angka(baris.total)}`)
  console.log(`  aktif          : ${angka(baris.aktif)}`)
  console.log(`  sudah tertaut  : ${angka(baris.tertaut)}`)
  console.log(`  diabaikan      : ${angka(baris.diabaikan)}`)
  console.log(`  PERLU DITAUTKAN: ${angka(baris.perlu)}`)
  console.log(`  punya harga SP : ${angka(baris.berharga)}`)

  const daftar = await q<{ kode: string; nama: string; sp: string | null; stok: string | null }>(
    `SELECT a.\`Kode Accurate\` AS kode, a.\`NAMA BARANG\` AS nama, a.\`SP\` AS sp, a.\`Stok Sistem\` AS stok
     FROM accurate_products a
     LEFT JOIN products p ON p.accurate_code = a.\`Kode Accurate\`
     LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
     WHERE a.\`KATEGORI\` = ?
       AND (a.\`STATUS\` <> 'YA' OR a.\`STATUS\` IS NULL)
       AND p.woo_id IS NULL AND ig.kode_accurate IS NULL
     ORDER BY
       -- Yang PUNYA harga lebih dulu: menautkannya langsung berbuah saat
       -- disinkronkan. Yang tanpa harga tetap perlu ditautkan suatu saat,
       -- tapi mendahulukannya berarti bekerja tanpa hasil yang terlihat.
       (a.\`SP\` IS NULL OR a.\`SP\` = '' OR CAST(a.\`SP\` AS DECIMAL(18,0)) <= 0),
       -- Lalu yang berstok: barang yang ada di gudang lebih mungkin dicari
       -- pembeli hari ini daripada yang stoknya nol.
       (a.\`Stok Sistem\` IS NULL OR a.\`Stok Sistem\` = 0),
       a.\`NAMA BARANG\`
     LIMIT ?`,
    KATEGORI,
    CONTOH,
  )

  console.log(`\n=== ${daftar.length} teratas yang perlu ditautkan (berharga dulu, lalu berstok) ===`)
  for (const r of daftar) {
    const harga = parseHargaAccurate(r.sp)
    const sp = harga.nilai === null ? "—" : harga.nilai.toLocaleString("id-ID")
    // Catatan dari parser ikut ditampilkan — angka seperti "145" yang mungkin
    // ribuannya terpotong perlu dilihat manusia sebelum ditautkan.
    const catatan = harga.catatan ? `  !! ${harga.catatan}` : ""
    console.log(
      `  ${r.kode.padEnd(12)} stok=${String(r.stok ?? "0").padStart(3)}  SP=${sp.padStart(12)}  ${r.nama.replace(/\r?\n/g, " ").slice(0, 44)}${catatan}`,
    )
  }
  if (Number(baris.perlu) > daftar.length) {
    console.log(`  … dan ${angka(Number(baris.perlu) - daftar.length)} lagi. Tambahkan --contoh <angka> untuk melihat lebih banyak.`)
  }
}

await prisma.$disconnect()
