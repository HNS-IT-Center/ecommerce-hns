/**
 * Pecah produk SIMPLE jadi induk VARIABLE + satu VARIATION per warna/tipe, menurut
 * daftar keputusan (bawaan backup/cocokkan-tautan/keputusan-pecah-warna.json), lalu
 * tautkan tiap variasi ke kode Accurate-nya.
 *
 * Latar (14 Okt 2026): review sisa "Jelas" menemukan 68 barang Accurate (tiap warna
 * satu kode) yang menunjuk satu produk web tanpa varian. Satu produk hanya bisa
 * memegang satu kode (`accurate_code` unik), jadi warna lain tidak pernah tertaut
 * dan stoknya tidak sampai ke web. Bedanya dengan pecah-varian-laptop.mts: skrip itu
 * menebak warna dari nomor part di nama laptop; skrip ini memakai daftar yang sudah
 * diputuskan, jadi berlaku untuk barang apa pun (mouse, kursi, speaker, ...).
 * Aturan pemilik: kode berawalan 2 dipakai, kode 1xxxxx tidak (sudah diterapkan saat
 * menyusun daftar).
 *
 * Tiap produk diperiksa ulang ke database dan HANYA diproses kalau: masih SIMPLE dan
 * tayang, namanya sama dengan saat ditinjau, nilai varian tidak kembar, dan setiap
 * kode ada di accurate_products atau accurate_items, tidak ditandai tidak dijual, tidak menambat produk
 * lain, dan tidak jadi SKU produk lain. Kalau induk sudah bertaut, kodenya harus
 * salah satu kode variasinya (dipindah ke variasi itu).
 *
 * Variasi: woo_id >= 900.000.000, harga (dan tanggal akhir diskon) disalin dari
 * induk — data katalog yang ditetapkan staff, tidak dihitung (CLAUDE.md §2.7). Stok
 * dibiarkan kosong; sinkron stok Accurate yang mengisinya.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server scripts/pecah-varian-warna.mts
 *   ... --tulis              # tulis ke database lokal
 *   ... --produksi           # uji kering terhadap PRODUKSI (baca saja)
 *   ... --produksi --tulis   # TULIS ke produksi
 *   ... --masukan <berkas>   # bawaan: backup/cocokkan-tautan/keputusan-pecah-warna.json
 *   ... --oleh "Nama"        # nama di log produk (bawaan: "Pecah varian warna")
 *
 * Aman diulang: produk yang sudah VARIABLE dilewati. Berkas pemulihan
 * backup/pecah-varian-warna-<waktu>.sql ditulis ulang setelah tiap produk selesai.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const arg = (nama: string) => {
  const i = process.argv.indexOf(nama)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")
const MASUKAN = arg("--masukan") ?? "backup/cocokkan-tautan/keputusan-pecah-warna.json"
const OLEH = arg("--oleh") ?? "Pecah varian warna"

const envMap: Record<string, string> = {}
for (const baris of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  envMap[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "")
  process.env[m[1]!] ??= envMap[m[1]!]
}
if (PRODUKSI) {
  if (!envMap.PROD_DATABASE_URL) {
    console.error("PROD_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).")
    process.exit(1)
  }
  process.env.DATABASE_URL = envMap.PROD_DATABASE_URL
}

type Masukan = { wooId: number; namaWeb: string; atribut: string; varian: { nilai: string; kode: string }[] }
const masukan = (JSON.parse(readFileSync(MASUKAN, "utf8")) as { pecah: Masukan[] }).pecah

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { ProductType, ProductSource } = await import("@prisma/client")
const { tautkanKode } = await import("../src/lib/api/accurate/price-table.ts")
const prisma = getPrisma()

const url = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:"))
console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? "  ← PRODUKSI" : ""}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}`)
console.log(`Masukan  : ${MASUKAN} — ${masukan.length} produk\n`)

const ringkas = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase()
function slugify(name: string, wooId: number): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${wooId}`
}

const semuaKode = [...new Set(masukan.flatMap((m) => m.varian.map((v) => v.kode)))]
const daftar = (xs: unknown[]) => xs.map(() => "?").join(",") || "NULL"
const diSheet = new Set(
  (await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT \`Kode Accurate\` AS k FROM accurate_products WHERE \`Kode Accurate\` IN (${daftar(semuaKode)})`,
    ...semuaKode,
  )).map((r) => r.k),
)
// Kode yang belum ada di Sheet tapi ada di salinan API juga sah (namaBarangAccurate, 15 Okt 2026).
for (const r of await prisma.$queryRawUnsafe<{ k: string }[]>(
  `SELECT code AS k FROM accurate_items WHERE status <> 'deleted' AND code IN (${daftar(semuaKode)})`,
  ...semuaKode,
))
  diSheet.add(r.k)
const diabaikan = new Set(
  (await prisma.$queryRawUnsafe<{ k: string }[]>(
    `SELECT kode_accurate AS k FROM accurate_ignored WHERE kode_accurate IN (${daftar(semuaKode)})`,
    ...semuaKode,
  )).map((r) => r.k),
)
const pemegangKode = new Map(
  (await prisma.product.findMany({ where: { accurateCode: { in: semuaKode } }, select: { id: true, accurateCode: true } })).map(
    (p) => [p.accurateCode!, p.id],
  ),
)
const pemegangSku = new Map(
  (await prisma.product.findMany({ where: { sku: { in: semuaKode } }, select: { id: true, sku: true } })).map((p) => [p.sku!, p.id]),
)

const calon = await prisma.product.findMany({
  where: { wooId: { in: masukan.map((m) => m.wooId) } },
  select: {
    id: true, wooId: true, name: true, sku: true, status: true, type: true, accurateCode: true,
    regularPrice: true, salePrice: true, saleEndDate: true,
  },
})
const perWoo = new Map(calon.map((p) => [p.wooId, p]))

type Rencana = (typeof calon)[number] & { atribut: string; varian: { nilai: string; kode: string }[] }
const rencana: Rencana[] = []
const dilewati: { m: Masukan; alasan: string }[] = []
for (const m of masukan) {
  const p = perWoo.get(m.wooId)
  const tolak = (alasan: string) => dilewati.push({ m, alasan })
  if (!p) { tolak("produk web tidak ditemukan"); continue }
  if (p.type === ProductType.VARIABLE) { tolak("sudah VARIABLE (sudah dipecah?)"); continue }
  if (p.type !== ProductType.SIMPLE) { tolak(`tipe ${p.type}, bukan SIMPLE`); continue }
  if (p.status !== "PUBLISHED") { tolak(`tidak tayang (${p.status})`); continue }
  if (ringkas(p.name) !== ringkas(m.namaWeb)) { tolak("nama produk web berubah sejak ditinjau"); continue }
  if (m.varian.length < 2) { tolak("kurang dari dua variasi"); continue }
  const nilai = m.varian.map((v) => ringkas(v.nilai))
  if (new Set(nilai).size !== nilai.length) { tolak("nilai varian kembar"); continue }
  const masalah = m.varian.flatMap((v) => {
    const r: string[] = []
    if (!v.kode.startsWith("2")) r.push(`${v.kode} bukan kode berawalan 2`)
    if (!diSheet.has(v.kode)) r.push(`${v.kode} tidak dikenal (tidak ada di Sheet maupun API Accurate)`)
    if (diabaikan.has(v.kode)) r.push(`${v.kode} ditandai tidak dijual di web`)
    const pk = pemegangKode.get(v.kode)
    if (pk !== undefined && pk !== p.id) r.push(`${v.kode} sudah menambat produk lain`)
    const ps = pemegangSku.get(v.kode)
    if (ps !== undefined && ps !== p.id) r.push(`${v.kode} sudah jadi SKU produk lain`)
    return r
  })
  if (p.accurateCode && !m.varian.some((v) => v.kode === p.accurateCode)) {
    masalah.push(`induk tertaut ke ${p.accurateCode}, yang bukan salah satu kode variasinya`)
  }
  if (masalah.length) { tolak(masalah.join("; ")); continue }
  rencana.push({ ...p, atribut: m.atribut, varian: m.varian })
}

console.log(`=== RENCANA ===`)
console.log(`Produk yang dipecah : ${rencana.length}`)
console.log(`Variasi baru        : ${rencana.reduce((s, r) => s + r.varian.length, 0)}`)
console.log(`Dilewati            : ${dilewati.length}\n`)
for (const r of rencana) {
  console.log(`#${r.wooId} ${r.name.slice(0, 90)}`)
  console.log(`   SKU ${r.sku ?? "-"} | kode induk ${r.accurateCode ?? "-"}${r.accurateCode ? " (dipindah ke variasinya)" : ""} | atribut ${r.atribut}`)
  for (const v of r.varian) console.log(`   - ${v.nilai.padEnd(28)} ${v.kode}`)
}
if (dilewati.length) {
  console.log(`\n=== DILEWATI ===`)
  for (const d of dilewati) console.log(`#${d.m.wooId} ${d.m.namaWeb.slice(0, 80)}\n   alasan: ${d.alasan}`)
}

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}
if (rencana.length === 0) {
  console.log("\nTidak ada produk yang perlu dipecah.")
  await prisma.$disconnect()
  process.exit(0)
}

mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const berkasBackup = `backup/pecah-varian-warna-${stamp}.sql`
const kutip = (s: string | null) => (s === null ? "NULL" : `'${s.replace(/'/g, "''")}'`)
let backupSql =
  `-- Pemulihan pecah-varian-warna, ${new Date().toISOString()}, database ${url.pathname.slice(1)} @ ${url.hostname}${PRODUKSI ? " (PRODUKSI)" : ""}\n` +
  `-- Per produk: lepaskan kode variasinya, hapus variasinya (atributnya ikut terhapus),\n` +
  `-- lalu kembalikan induk ke SIMPLE dengan SKU dan kode Accurate semula. Urutannya penting:\n` +
  `-- kode dan SKU unik, jadi variasinya harus melepasnya dulu.\n\n`
writeFileSync(berkasBackup, backupSql)
console.log(`\nBerkas pemulihan: ${berkasBackup}`)

const atributId = new Map<string, number>()
for (const nama of new Set(rencana.map((r) => r.atribut))) {
  const a = await prisma.attribute.upsert({ where: { name: nama }, create: { name: nama }, update: {} })
  atributId.set(nama, a.id)
}

let dipecah = 0
let ditautkan = 0
const gagal: string[] = []
for (const [i, r] of rencana.entries()) {
  console.log(`[${i + 1}/${rencana.length}] #${r.wooId} ${r.name.slice(0, 60)}...`)
  const dibuat: { id: number; wooId: number; kode: string }[] = []
  const idAtribut = atributId.get(r.atribut)!
  try {
    await prisma.$transaction(
      async (tx) => {
        // SKU induk dikosongkan DULU: SKU unik, dan variasinya memakai kode sebagai SKU.
        // `select: { id }` di setiap create/update produk: tanpa itu Prisma membaca balik
        // SEMUA kolom, termasuk kolom migrasi F2 yang belum tentu ada di produksi.
        await tx.product.update({ where: { id: r.id }, data: { type: ProductType.VARIABLE, sku: null }, select: { id: true } })
        for (const [posisi, v] of r.varian.entries()) {
          const nilai = await tx.attributeValue.upsert({
            where: { attributeId_value: { attributeId: idAtribut, value: v.nilai } },
            create: { attributeId: idAtribut, value: v.nilai },
            update: {},
          })
          const maks = await tx.product.aggregate({ _max: { wooId: true }, where: { wooId: { gte: 900_000_000 } } })
          const wooId = Math.max(maks._max.wooId ?? 0, 900_000_000 - 1) + 1
          const nama = `${r.name} - ${v.nilai}`
          const baru = await tx.product.create({
            data: {
              wooId,
              source: ProductSource.LOCAL,
              type: ProductType.VARIATION,
              status: r.status,
              parentId: r.id,
              name: nama,
              slug: slugify(nama, wooId),
              sku: v.kode,
              regularPrice: r.regularPrice,
              salePrice: r.salePrice,
              saleEndDate: r.saleEndDate,
            },
            select: { id: true },
          })
          await tx.productAttribute.create({
            data: { productId: baru.id, attributeId: idAtribut, valueId: nilai.id, position: posisi },
          })
          dibuat.push({ id: baru.id, wooId, kode: v.kode })
        }
      },
      { timeout: 30000 },
    )
  } catch (e) {
    gagal.push(`#${r.wooId}: ${e instanceof Error ? e.message : String(e)} (tidak ada yang tersimpan untuk produk ini)`)
    continue
  }
  dipecah++
  const ids = dibuat.map((d) => d.id).join(",")
  backupSql +=
    `-- Induk #${r.wooId} (id ${r.id}) ${r.name.replace(/\n/g, " ")}\n` +
    `UPDATE products SET accurate_code = NULL WHERE id IN (${ids});\n` +
    `DELETE FROM products WHERE id IN (${ids});\n` +
    `UPDATE products SET type = 'SIMPLE', sku = ${kutip(r.sku)}, accurate_code = ${kutip(r.accurateCode)} WHERE id = ${r.id};\n\n`
  writeFileSync(berkasBackup, backupSql)

  // Tautan lewat jalur yang sama dengan tombol Tautkan (tercatat di product_logs).
  if (r.accurateCode) {
    const lepas = await tautkanKode(r.wooId, null, OLEH)
    if (!lepas.ok) {
      gagal.push(`#${r.wooId}: gagal melepas kode induk ${r.accurateCode}: ${lepas.alasan}`)
      continue
    }
  }
  for (const d of dibuat) {
    const h = await tautkanKode(d.wooId, d.kode, OLEH, { isiSku: true })
    if (h.ok) ditautkan++
    else gagal.push(`#${r.wooId} variasi ${d.wooId}: ${d.kode} gagal ditautkan: ${h.alasan}`)
  }
}

const induk = await prisma.product.findMany({
  where: { id: { in: rencana.map((r) => r.id) } },
  select: { type: true, accurateCode: true, variations: { select: { accurateCode: true, sku: true } } },
})
const variasiCocok = induk.flatMap((p) => p.variations).filter((v) => v.accurateCode !== null && v.accurateCode === v.sku).length
console.log(`\n=== HASIL ===`)
console.log(`Produk dipecah        : ${dipecah} dari ${rencana.length}`)
console.log(`Variasi tertaut       : ${ditautkan} (terverifikasi di DB: ${variasiCocok})`)
console.log(`Induk masih berkode   : ${induk.filter((p) => p.accurateCode !== null).length}`)
console.log(`Gagal                 : ${gagal.length}`)
for (const g of gagal) console.log(`  ${g}`)
console.log(`Berkas pemulihan      : ${berkasBackup}`)
await prisma.$disconnect()
