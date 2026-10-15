/**
 * Bongkar produk yang skunya menggabungkan >1 kode Accurate ("kode1 / kode2")
 * jadi struktur variant yang benar: induk VARIABLE + anak VARIATION per warna,
 * memakai atribut "Warna" — mengikuti struktur yang sudah dipakai 2.077 varian
 * lain di katalog (lihat syncProductVariations di lib/api/woocommerce/products.ts).
 *
 * Lingkup skrip ini SENGAJA dipersempit: hanya produk yang (a) SEMUA kode
 * Accurate-nya aktif (STATUS <> "YA") dan (b) warnanya bisa diambil jelas dari
 * akhiran "(WARNA)" di nama Accurate. Sisanya (kode nonaktif, warna ambigu,
 * format sku rusak, atau kasus beda-merek) sengaja DILEWATI — lihat memori
 * project_hns_besok_gabung_varian untuk daftarnya.
 *
 *   # uji kering ke DATABASE_URL (lokal per docs/16 — aman, tidak menulis apa pun)
 *   npx tsx scripts/gabung-varian-warna.mts
 *
 *   # tulis ke DATABASE_URL (lokal)
 *   npx tsx scripts/gabung-varian-warna.mts --tulis
 *
 *   # PRODUKSI — baca .env.local, override ke PROD_DATABASE_URL. Uji kering dulu:
 *   npx tsx scripts/gabung-varian-warna.mts --produksi
 *   # baru kalau hasil pratinjaunya benar, TULIS ke produksi:
 *   npx tsx scripts/gabung-varian-warna.mts --tulis --produksi
 *
 * Aman diulang: baris yang sudah type=VARIABLE (sudah diproses) dilewati.
 * Backup pemulihan ditulis ke backup/gabung-varian-warna-<stamp>.sql sebelum
 * menulis apa pun.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")
const PRODUKSI = process.argv.includes("--produksi")

const isiEnv = readFileSync(".env.local", "utf8")
const envMap: Record<string, string> = {}
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  envMap[m[1]!] = m[2]!.trim().replace(/^["']|["']$/g, "")
  process.env[m[1]!] ??= envMap[m[1]!]
}

if (PRODUKSI) {
  const prod = envMap.PROD_DATABASE_URL
  if (!prod) {
    console.error("PROD_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).")
    process.exit(1)
  }
  process.env.DATABASE_URL = prod
}

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { ProductType, ProductStatus, ProductSource } = await import("@prisma/client")
const prisma = getPrisma()

const namaDb = new URL((process.env.DATABASE_URL ?? "").replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb}${PRODUKSI ? "  ← PRODUKSI" : "  (lokal)"}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

type BarisAccurate = { kode: string; nama: string; status: string | null }

function ambilWarna(nama: string): string | null {
  const m = nama.match(/\(([^()]+)\)\s*$/)
  if (!m) return null
  const isi = m[1]!.trim()
  if (/\d/.test(isi)) return null
  if (isi.length > 30) return null
  return isi
}

function slugify(name: string, wooId: number): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") + `-${wooId}`
  )
}

// Kandidat: masih SIMPLE (belum diproses) dan skunya menggabungkan >1 kode.
const kandidat = await prisma.product.findMany({
  where: { sku: { contains: "/" }, type: ProductType.SIMPLE },
  select: {
    id: true, name: true, sku: true, status: true, regularPrice: true,
    salePrice: true, accurateCode: true,
  },
})

const semuaKode = [...new Set(kandidat.flatMap((p) => (p.sku ?? "").split("/").map((k) => k.trim())))]
const rows = semuaKode.length
  ? ((await prisma.$queryRawUnsafe(
      `SELECT \`Kode Accurate\` AS kode, \`NAMA BARANG\` AS nama, \`STATUS\` AS status
       FROM accurate_products WHERE \`Kode Accurate\` IN (${semuaKode.map(() => "?").join(",")})`,
      ...semuaKode
    )) as BarisAccurate[])
  : []
const peta = new Map(rows.map((r) => [r.kode, r]))
const aktif = (r?: BarisAccurate) => !!r && r.status !== "YA"

type Rencana = {
  parentId: number
  parentName: string
  parentStatus: (typeof ProductStatus)[keyof typeof ProductStatus]
  regularPrice: unknown
  salePrice: unknown
  originalSku: string
  varian: { kode: string; warna: string }[]
}

const rencana: Rencana[] = []
for (const p of kandidat) {
  const kodeList = (p.sku ?? "").split("/").map((k) => k.trim()).filter(Boolean)
  const detail = kodeList.map((k) => ({ kode: k, info: peta.get(k) }))

  if (detail.some((d) => !d.info)) continue
  if (!detail.every((d) => aktif(d.info))) continue

  const varian = detail.map((d) => ({ kode: d.kode, warna: ambilWarna(d.info!.nama) }))
  if (varian.some((v) => v.warna === null)) continue

  rencana.push({
    parentId: p.id,
    parentName: p.name,
    parentStatus: p.status,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice,
    originalSku: p.sku!,
    varian: varian as { kode: string; warna: string }[],
  })
}

// Kode yang dipakai >1 produk induk sekaligus = data bermasalah (kode
// tertukar/tertempel salah antar produk kembar). JANGAN ditebak siapa yang
// benar — keluarkan KEDUA produknya dari rencana, laporkan untuk ditinjau
// manual. Ini persis insiden yang dijaga keunikan `accurate_code` (docs/13).
const pemakaiKode = new Map<string, number[]>()
for (const r of rencana) {
  for (const v of r.varian) {
    const list = pemakaiKode.get(v.kode) ?? []
    list.push(r.parentId)
    pemakaiKode.set(v.kode, list)
  }
}
const kodeBentrok = [...pemakaiKode.entries()].filter(([, ids]) => new Set(ids).size > 1)
const parentBermasalah = new Set(kodeBentrok.flatMap(([, ids]) => ids))

// Kode yang sudah dipakai produk LAIN di luar 70 ini (sku sudah ada di DB).
const kodeRencana = [...new Set(rencana.flatMap((r) => r.varian.map((v) => v.kode)))]
const parentIds = new Set(rencana.map((r) => r.parentId))
const skuDipakai = kodeRencana.length
  ? await prisma.product.findMany({
      where: { sku: { in: kodeRencana } },
      select: { id: true, sku: true, parentId: true },
    })
  : []
const kodeSudahDipakaiEksternal = new Set(
  skuDipakai.filter((row) => !parentIds.has(row.parentId ?? -1)).map((row) => row.sku!)
)
for (const r of rencana) {
  if (r.varian.some((v) => kodeSudahDipakaiEksternal.has(v.kode))) parentBermasalah.add(r.parentId)
}

if (kodeBentrok.length > 0) {
  console.log("\n=== DILEWATI — kode dipakai >1 produk induk, perlu tinjau manual ===")
  for (const [kode, ids] of kodeBentrok) console.log(`  ${kode} dipakai oleh produk #${[...new Set(ids)].join(" dan #")}`)
}
if (kodeSudahDipakaiEksternal.size > 0) {
  console.log("\n=== DILEWATI — kode sudah jadi sku produk lain di luar batch ini ===")
  for (const kode of kodeSudahDipakaiEksternal) console.log(`  ${kode}`)
}

const rencanaBersih = rencana.filter((r) => !parentBermasalah.has(r.parentId))

const totalVarian = rencanaBersih.reduce((s, r) => s + r.varian.length, 0)
console.log(`\nProduk induk yang diproses : ${rencanaBersih.length} (${parentBermasalah.size} dilewati karena bentrok)`)
console.log(`Varian baru yang dibuat    : ${totalVarian}\n`)

for (const r of rencanaBersih) {
  console.log(`#${r.parentId} ${r.parentName.slice(0, 70)}`)
  for (const v of r.varian) console.log(`   - ${v.kode} → ${v.warna}`)
}

if (!TULIS) {
  console.log("\nUji kering selesai — tidak ada yang ditulis. Tambahkan --tulis untuk menulis.")
  await prisma.$disconnect()
  process.exit(0)
}

if (rencanaBersih.length === 0) {
  console.log("\nTidak ada kandidat tersisa (mungkin sudah diproses semua, atau semuanya bentrok).")
  await prisma.$disconnect()
  process.exit(0)
}

// --- Backup pemulihan sebelum menulis. Ditulis ULANG ke disk setelah TIAP
// produk berhasil — supaya kalau ada yang gagal di tengah jalan, backup yang
// sudah ada di disk tetap mencakup semua yang SUDAH benar-benar tersimpan. ---
mkdirSync("backup", { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, "-")
const backupPath = `backup/gabung-varian-warna-${stamp}.sql`
let backupSql = `-- Pemulihan gabung-varian-warna, dibuat ${new Date().toISOString()}\n`
backupSql += `-- Jalankan baris DELETE dulu, baru UPDATE, per blok produk induk.\n\n`

const attribute = await prisma.attribute.upsert({
  where: { name: "Warna" },
  create: { name: "Warna" },
  update: {},
})

let dibuat = 0
let gagal = 0
for (const [idx, r] of rencanaBersih.entries()) {
  const variationIds: number[] = []
  console.log(`[${idx + 1}/${rencanaBersih.length}] #${r.parentId} ${r.parentName.slice(0, 60)}...`)

  try {
  await prisma.$transaction(async (tx) => {
    for (const v of r.varian) {
      const value = await tx.attributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value: v.warna } },
        create: { attributeId: attribute.id, value: v.warna },
        update: {},
      })

      const maxWoo = await tx.product.aggregate({
        _max: { wooId: true },
        where: { wooId: { gte: 900_000_000 } },
      })
      const wooId = Math.max(maxWoo._max.wooId ?? 0, 900_000_000 - 1) + 1

      const name = `${r.parentName} - ${v.warna}`
      const created = await tx.product.create({
        data: {
          wooId,
          source: ProductSource.LOCAL,
          type: ProductType.VARIATION,
          status: r.parentStatus,
          parentId: r.parentId,
          name,
          slug: slugify(name, wooId),
          sku: v.kode,
          regularPrice: r.regularPrice as never,
          salePrice: r.salePrice as never,
        },
      })
      variationIds.push(created.id)

      await tx.productAttribute.create({
        data: { productId: created.id, attributeId: attribute.id, valueId: value.id, position: 0 },
      })
    }

    await tx.product.update({
      where: { id: r.parentId },
      data: { type: ProductType.VARIABLE, sku: null },
    })
  }, { timeout: 30000 })

  dibuat += r.varian.length
  backupSql += `-- Induk #${r.parentId} ${r.parentName.replace(/'/g, "''")}\n`
  backupSql += `DELETE FROM products WHERE id IN (${variationIds.join(",")});\n`
  backupSql += `UPDATE products SET type='SIMPLE', sku='${r.originalSku.replace(/'/g, "''")}' WHERE id=${r.parentId};\n\n`
  writeFileSync(backupPath, backupSql)
  } catch (err) {
    gagal++
    console.error(`   GAGAL: ${err instanceof Error ? err.message : String(err)}`)
    console.error(`   (dilewati, lanjut ke produk berikutnya — tidak ada yang tertulis untuk produk ini)`)
  }
}

console.log(`\nBackup pemulihan ditulis ke ${backupPath}`)

// --- Verifikasi ---
const jumlahVariable = await prisma.product.count({
  where: { id: { in: rencanaBersih.map((r) => r.parentId) }, type: ProductType.VARIABLE },
})
const targetSukses = rencanaBersih.length - gagal
console.log(`\nVerifikasi: ${jumlahVariable}/${rencanaBersih.length} induk sekarang VARIABLE, ${dibuat} varian dibuat, ${gagal} gagal.`)
if (jumlahVariable !== targetSukses) {
  console.error("PERINGATAN: jumlah tidak cocok dengan yang diharapkan — periksa manual.")
}

await prisma.$disconnect()
