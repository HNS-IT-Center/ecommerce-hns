/**
 * Terapkan usulan tautan Accurate ↔ produk web yang SUDAH DITINJAU.
 *
 * Masukannya `backup/cocokkan-tautan/keputusan.json` — daftar pasangan yang
 * disetujui dari berkas tinjauan (hasil `cocokkan-tautan-accurate.mts`).
 * Skrip ini tidak memilih apa pun sendiri; ia hanya menuliskan yang disetujui.
 *
 * Setiap baris diperiksa ulang terhadap database TUJUAN sebelum ditulis —
 * pencocokan dibuat di salinan lokal, dan di antara keduanya staff bisa saja
 * sudah menautkan, mengganti nama, atau menutup produknya. Baris dilewati
 * (dengan alasan) bila:
 *   - produk web tidak ada, atau namanya sudah berubah dari yang ditinjau;
 *   - produk web SUDAH punya kode Accurate — tautan buatan manusia tidak
 *     pernah ditimpa (tautkanKode sendiri akan menimpanya tanpa bertanya);
 *   - produk web tidak tayang (kebijakan 21 Sep: tautan hanya untuk yang terbit);
 *   - kode Accurate tidak ada di accurate_products maupun accurate_items, sudah menambat produk lain,
 *     atau ditandai "tidak dijual di web";
 *   - kode atau produk yang sama muncul dua kali di masukan.
 *
 * SATU pengecualian untuk "kode sudah menambat produk lain": kode yang
 * menempel di produk induk VARIABLE dan diusulkan ke variasi induk itu
 * sendiri. Induk tidak bisa ditautkan (yang dijual variasinya), dan kode itu
 * sisa sebelum produknya dipecah jadi varian — gabung-varian-warna 29 Sep
 * memindahkan SKU-nya ke variasi tapi kode Accurate-nya tertinggal di induk.
 * Kodenya DIPINDAH: dilepas dari induk (tercatat UNLINK_ACCURATE), lalu
 * ditautkan ke variasinya; berkas pemulihan mengembalikannya ke induk.
 *
 * Menulis lewat `tautkanKode` — jalur yang sama dengan tombol Tautkan di
 * panel — jadi setiap tautan tercatat sebagai LINK_ACCURATE di product_logs,
 * dan SKU yang kosong ikut diisi kode Accurate.
 *
 * Masukan boleh juga memuat `abaikan`: kode yang ditandai "tidak dijual di
 * web" di lembar kerja (kolom TIDAK DIJUAL DI WEB). Ditulis lewat
 * `abaikanKodeMassal` — jalur penandaan massal di panel Update Harga —
 * per `BATAS_MASSAL` kode. Kode yang masih tertaut, sudah ditandai, atau
 * sekaligus diisi WOO ID dilewati.
 *
 * Bawaannya UJI KERING. Sebelum menulis, berkas pemulihan disimpan di
 * `backup/terapkan-tautan-<waktu>.sql` (di-gitignore — hanya ada di laptop
 * yang menjalankan).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/terapkan-usulan-tautan.mts
 *   ... --tulis                    # tulis ke database lokal
 *   ... --produksi                 # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis         # TULIS ke produksi
 *   ... --masukan <berkas.json>    # bawaan: backup/cocokkan-tautan/keputusan.json
 *   ... --oleh "Nama"              # nama di log produk (bawaan: "Tautan massal (ditinjau)")
 *
 * Aman diulang: baris yang sudah tertaut tidak lagi memenuhi syarat.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const MASUKAN = arg("--masukan") ?? "backup/cocokkan-tautan/keputusan.json"
const OLEH = arg("--oleh") ?? "Tautan massal (ditinjau)"

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

type Baris = { kode: string; wooId: number; namaWeb: string; namaAccurate: string; tingkat: string; sumber: string }
type Abaikan = { kode: string; namaAccurate: string }
const isiMasukan = JSON.parse(readFileSync(MASUKAN, "utf8")) as { pasangan?: Baris[]; abaikan?: Abaikan[] }
const masukan = isiMasukan.pasangan ?? []
const masukanAbaikan = isiMasukan.abaikan ?? []

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { tautkanKode, abaikanKodeMassal, BATAS_MASSAL } = await import("../src/lib/api/accurate/price-table.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Masukan  : ${MASUKAN} — ${masukan.length} pasangan, ${masukanAbaikan.length} ditandai tidak dijual\n`)

// --- Pemeriksaan ulang, beberapa kueri untuk seluruh masukan ---------------
const daftar = <T,>(xs: T[]) => xs.map(() => "?").join(",") || "NULL"
const wooIds = [...new Set(masukan.map((b) => b.wooId))]
const kodes = [...new Set([...masukan.map((b) => b.kode), ...masukanAbaikan.map((a) => a.kode)])]

type ProdukTujuan = {
  nama: string
  kode: string | null
  sku: string | null
  status: string
  statusInduk: string | null
  tipe: string
  indukWoo: number | null
}
const produk = new Map<number, ProdukTujuan>()
for (let i = 0; i < wooIds.length; i += 500) {
  const potong = wooIds.slice(i, i + 500)
  const rows = await prisma.$queryRawUnsafe<(Omit<ProdukTujuan, "indukWoo"> & { wooId: number | bigint; indukWoo: number | bigint | null })[]>(
    `SELECT p.woo_id AS wooId, p.name AS nama, p.accurate_code AS kode, p.sku, p.status, par.status AS statusInduk, p.type AS tipe,
            par.woo_id AS indukWoo
       FROM products p LEFT JOIN products par ON par.id = p.parent_id
      WHERE p.woo_id IN (${daftar(potong)})`,
    ...potong,
  )
  for (const r of rows) produk.set(Number(r.wooId), { ...r, indukWoo: r.indukWoo == null ? null : Number(r.indukWoo) })
}
const diSheet = new Set<string>()
const dipakai = new Map<string, { wooId: number; tipe: string }>()
const diabaikan = new Set<string>()
for (let i = 0; i < kodes.length; i += 500) {
  const potong = kodes.slice(i, i + 500)
  for (const r of await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT \`Kode Accurate\` AS k FROM accurate_products WHERE \`Kode Accurate\` IN (${daftar(potong)})`,
    ...potong,
  ))
    diSheet.add(r.k)
  // Kode yang belum ada di Sheet tapi ada di salinan API juga sah (namaBarangAccurate, 15 Okt 2026).
  for (const r of await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT code AS k FROM accurate_items WHERE status <> 'deleted' AND code IN (${daftar(potong)})`,
    ...potong,
  ))
    diSheet.add(r.k)
  for (const r of await prisma.$queryRawUnsafe<{ k: string; w: number | bigint; t: string }[]>(
    `SELECT accurate_code AS k, woo_id AS w, type AS t FROM products WHERE accurate_code IN (${daftar(potong)})`,
    ...potong,
  ))
    dipakai.set(r.k, { wooId: Number(r.w), tipe: r.t })
  for (const r of await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT kode_accurate AS k FROM accurate_ignored WHERE kode_accurate IN (${daftar(potong)})`,
    ...potong,
  ))
    diabaikan.add(r.k)
}

const hitungKode = new Map<string, number>()
const hitungWoo = new Map<number, number>()
for (const b of masukan) {
  hitungKode.set(b.kode, (hitungKode.get(b.kode) ?? 0) + 1)
  hitungWoo.set(b.wooId, (hitungWoo.get(b.wooId) ?? 0) + 1)
}
const ringkas = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase()

type Rencana = Baris & { dariInduk?: number }
const rencana: Rencana[] = []
const lewat = new Map<string, Baris[]>()
const catat = (alasan: string, b: Baris) => lewat.set(alasan, [...(lewat.get(alasan) ?? []), b])
for (const b of masukan) {
  const p = produk.get(b.wooId)
  if (hitungKode.get(b.kode)! > 1) catat("kode muncul lebih dari sekali di masukan", b)
  else if (hitungWoo.get(b.wooId)! > 1) catat("produk muncul lebih dari sekali di masukan", b)
  else if (!p) catat("produk web tidak ditemukan", b)
  else if (p.kode === b.kode) catat("sudah tertaut ke kode ini (tidak perlu apa-apa)", b)
  else if (p.kode) catat("produk web sudah tertaut ke kode lain — tidak ditimpa", b)
  else if (ringkas(p.nama) !== ringkas(b.namaWeb)) catat("nama produk web berubah sejak ditinjau", b)
  // Induk VARIABLE tidak dijual sendiri — misalnya produk yang sesudah ditinjau
  // dipecah jadi varian oleh pecah-varian-laptop.mts. Kode harus ke variasinya.
  else if (p.tipe === "VARIABLE") catat("produk web sudah jadi induk VARIABLE — tautkan ke variasinya", b)
  else if (p.status !== "PUBLISHED" || (p.tipe === "VARIATION" && p.statusInduk !== "PUBLISHED")) catat("produk web tidak tayang", b)
  else if (!diSheet.has(b.kode)) catat("kode tidak dikenal (tidak ada di Sheet maupun API Accurate)", b)
  else if (diabaikan.has(b.kode)) catat("kode ditandai tidak dijual di web", b)
  else if (dipakai.has(b.kode)) {
    // Satu-satunya pemegang yang boleh dilangkahi: induk VARIABLE dari variasi tujuan.
    const pemegang = dipakai.get(b.kode)!
    if (pemegang.tipe === "VARIABLE" && p.tipe === "VARIATION" && pemegang.wooId === p.indukWoo) {
      rencana.push({ ...b, dariInduk: pemegang.wooId })
    } else catat(`kode sudah menambat produk lain`, b)
  } else rencana.push(b)
}

const rencanaAbaikan: Abaikan[] = []
const lewatAbaikan = new Map<string, Abaikan[]>()
const sudahDilihat = new Set<string>()
for (const a of masukanAbaikan) {
  const catatA = (alasan: string) => lewatAbaikan.set(alasan, [...(lewatAbaikan.get(alasan) ?? []), a])
  if (sudahDilihat.has(a.kode)) catatA("kode muncul lebih dari sekali di masukan")
  else if (hitungKode.has(a.kode)) catatA("kode juga diisi WOO ID — pilih salah satu")
  else if (!diSheet.has(a.kode)) catatA("kode tidak dikenal (tidak ada di Sheet maupun API Accurate)")
  else if (dipakai.has(a.kode)) catatA("kode masih tertaut ke produk web")
  else if (diabaikan.has(a.kode)) catatA("sudah ditandai tidak dijual (tidak perlu apa-apa)")
  else rencanaAbaikan.push(a)
  sudahDilihat.add(a.kode)
}

const NAMA_TINGKAT: Record<string, string> = { M: "pilihan manual" }
console.log(`=== RENCANA ===`)
console.log(`Akan ditautkan : ${rencana.length}`)
const nPindah = rencana.filter((b) => b.dariInduk != null).length
if (nPindah) console.log(`  (${nPindah} di antaranya DIPINDAH dari produk induk VARIABLE ke variasinya)`)
for (const t of [...new Set(rencana.map((b) => b.tingkat))].sort()) {
  const n = rencana.filter((b) => b.tingkat === t).length
  console.log(`  tingkat ${t}${NAMA_TINGKAT[t] ? ` (${NAMA_TINGKAT[t]})` : ""} : ${n}`)
}
console.log(`Dilewati       : ${masukan.length - rencana.length}`)
for (const [alasan, arr] of lewat) {
  console.log(`  - ${alasan}: ${arr.length}`)
  for (const b of arr.slice(0, 3)) console.log(`      ${b.kode} -> ${b.wooId} ${b.namaWeb.slice(0, 60)}`)
}
if (masukanAbaikan.length) {
  console.log(`\nAkan ditandai tidak dijual di web : ${rencanaAbaikan.length}`)
  console.log(`Dilewati                          : ${masukanAbaikan.length - rencanaAbaikan.length}`)
  for (const [alasan, arr] of lewatAbaikan) {
    console.log(`  - ${alasan}: ${arr.length}`)
    for (const a of arr.slice(0, 3)) console.log(`      ${a.kode} ${a.namaAccurate.slice(0, 60)}`)
  }
}
console.log(`\n--- Contoh 10 yang akan ditautkan ---`)
for (const b of rencana.slice(0, 10)) console.log(`  [${b.tingkat}] ${b.kode} ${b.namaAccurate.slice(0, 55)}\n        -> ${b.wooId} ${b.namaWeb.slice(0, 70)}`)

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

// --- Backup pemulihan DITULIS DULU, sebelum satu baris pun berubah ---------
mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/terapkan-tautan-${stamp}.sql`
const kutip = (s: string) => `'${s.replace(/'/g, "''")}'`
writeFileSync(
  berkasBackup,
  `-- Pemulihan terapkan-usulan-tautan, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
    `-- Melepas HANYA tautan yang dibuat skrip ini (kode & produk harus masih sama),\n` +
    `-- dan mengosongkan lagi SKU yang KOSONG sebelum skrip ini mengisinya. SKU yang\n` +
    `-- sudah berisi sebelumnya tidak disentuh — termasuk yang memang sama dengan\n` +
    `-- kodenya (pasangan jalur SKU). Uji lokal 9 Okt 2026 menangkap versi pertama\n` +
    `-- berkas ini mengosongkan 81 SKU seperti itu.\n\n` +
    rencana
      .map((b) => {
        const skuKosong = (produk.get(b.wooId)!.sku ?? "").trim() === ""
        return (
          `UPDATE products SET accurate_code = NULL WHERE woo_id = ${b.wooId} AND accurate_code = ${kutip(b.kode)};` +
          (skuKosong
            ? `\nUPDATE products SET sku = NULL WHERE woo_id = ${b.wooId} AND sku = ${kutip(b.kode)} AND accurate_code IS NULL;`
            : "") +
          // Sesudah variasinya dilepas (kolomnya unik), kode kembali ke induk.
          (b.dariInduk != null
            ? `\nUPDATE products SET accurate_code = ${kutip(b.kode)} WHERE woo_id = ${b.dariInduk} AND accurate_code IS NULL;`
            : "")
        )
      })
      .join("\n") +
    "\n" +
    (rencanaAbaikan.length
      ? `\n-- Membatalkan tanda "tidak dijual di web" yang dibuat skrip ini.\n` +
        rencanaAbaikan
          .map((a) => `DELETE FROM accurate_ignored WHERE kode_accurate = ${kutip(a.kode)} AND ditandai_oleh = ${kutip(OLEH)};`)
          .join("\n") +
        "\n"
      : ""),
)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

let berhasil = 0
let skuDiisi = 0
const gagal: string[] = []
for (const [i, b] of rencana.entries()) {
  try {
    if (b.dariInduk != null) {
      const lepas = await tautkanKode(b.dariInduk, null, OLEH)
      if (!lepas.ok) {
        gagal.push(`${b.kode} -> ${b.wooId}: gagal melepas dari induk ${b.dariInduk}: ${lepas.alasan}`)
        continue
      }
    }
    const h = await tautkanKode(b.wooId, b.kode, OLEH, { isiSku: true })
    if (h.ok) {
      berhasil++
      if ("skuDiisi" in h && h.skuDiisi) skuDiisi++
    } else gagal.push(`${b.kode} -> ${b.wooId}: ${h.alasan}`)
  } catch (e) {
    gagal.push(`${b.kode} -> ${b.wooId}: ${e instanceof Error ? e.message : String(e)}`)
  }
  if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${rencana.length} ...`)
}

// --- Verifikasi -------------------------------------------------------------
let terverifikasi = 0
for (let i = 0; i < rencana.length; i += 500) {
  const potong = rencana.slice(i, i + 500)
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM products WHERE ${potong.map(() => "(woo_id = ? AND accurate_code = ?)").join(" OR ")}`,
    ...potong.flatMap((b) => [b.wooId, b.kode]),
  )
  terverifikasi += Number(rows[0]!.n)
}
// --- Tanda "tidak dijual di web" ---------------------------------------------
let abaikanBerhasil = 0
const abaikanGagal: string[] = []
for (let i = 0; i < rencanaAbaikan.length; i += BATAS_MASSAL) {
  const potong = rencanaAbaikan.slice(i, i + BATAS_MASSAL).map((a) => a.kode)
  try {
    const h = await abaikanKodeMassal(potong, OLEH)
    abaikanBerhasil += h.berhasil.length
    for (const d of h.dilewati) abaikanGagal.push(`${d.kode}: ${d.alasan}`)
  } catch (e) {
    abaikanGagal.push(`${potong.length} kode mulai ${potong[0]}: ${e instanceof Error ? e.message : String(e)}`)
  }
}
let abaikanTerverifikasi = 0
for (let i = 0; i < rencanaAbaikan.length; i += 500) {
  const potong = rencanaAbaikan.slice(i, i + 500).map((a) => a.kode)
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM accurate_ignored WHERE kode_accurate IN (${daftar(potong)})`,
    ...potong,
  )
  abaikanTerverifikasi += Number(rows[0]!.n)
}

console.log(`\n=== HASIL ===`)
console.log(`Berhasil ditautkan : ${berhasil} (SKU kosong ikut diisi: ${skuDiisi})`)
console.log(`Terverifikasi di DB: ${terverifikasi} dari ${rencana.length}`)
console.log(`Gagal              : ${gagal.length}`)
for (const g of gagal.slice(0, 20)) console.log(`  ${g}`)
if (rencanaAbaikan.length) {
  console.log(`Ditandai tidak dijual : ${abaikanBerhasil} (terverifikasi ${abaikanTerverifikasi} dari ${rencanaAbaikan.length})`)
  console.log(`Gagal ditandai        : ${abaikanGagal.length}`)
  for (const g of abaikanGagal.slice(0, 20)) console.log(`  ${g}`)
}
await prisma.$disconnect()
