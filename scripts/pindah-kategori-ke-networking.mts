/**
 * Memindahkan kategori yang SUDAH ADA ke bawah `NETWORK TOOLS` (id 62).
 *
 * Bedanya dengan `subkategori-networking.mts`: skrip itu MEMBUAT kategori
 * baru dari nol; skrip ini memindahkan simpul yang sudah hidup di cabang lain
 * beserta seluruh produknya. Tidak ada kategori baru, tidak ada tautan produk
 * yang disentuh — yang berubah hanya `parent_id`, `path`, dan `depth`.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/pindah-kategori-ke-networking.mts
 *
 *   # benar-benar memindahkan
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/pindah-kategori-ke-networking.mts --tulis
 *
 * YANG SENGAJA TIDAK BERUBAH:
 *
 *  - **Tautan produk.** Memindahkan kategori tidak memindahkan produk antar
 *    kategori; produk tetap menempel pada kategori yang sama, dan kategori
 *    itulah yang pindah rumah. Produk yang sebelumnya juga tertaut ke
 *    `KABEL / CONVERTER` atau `USB HUB` TETAP tertaut ke sana — itu memang
 *    yang diminta: converter boleh hidup di dua tempat sekaligus.
 *
 *  - **Slug.** Sama seperti `renameCategory()` di lapisan admin, slug tidak
 *    ditulis ulang saat kategori pindah. Slug lama sudah beredar di tautan
 *    dan hasil pencarian; mengubahnya mematikan alamat yang sudah ada demi
 *    kerapian yang tidak dilihat siapa pun. Akibatnya slug bisa tidak lagi
 *    mencerminkan jalur barunya — `kabel-lan` di bawah NETWORK TOOLS —
 *    dan itu diterima dengan sadar.
 *
 * Path dan depth seluruh keturunan dihitung oleh `planCategoryMove()`, fungsi
 * yang sama persis yang dipakai tombol pindah di `/admin/kategori`. Skrip ini
 * sengaja tidak menyalin logikanya: pohon kategori punya kasus sudut (cincin,
 * path basi) yang sudah ditangani di sana.
 *
 * Aman diulang: kategori yang sudah berada di tujuan ditolak oleh
 * `planCategoryMove` dengan pesan "memang sudah berada di bawah ...", dan
 * skrip ini memperlakukannya sebagai "tidak ada yang perlu dikerjakan".
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")
const TUJUAN = 62 // NETWORK TOOLS

/**
 * Kategori yang dipindahkan, beserta alasannya.
 *
 * Ditulis tangan, bukan ditebak dari nama. Keputusan 28 September 2026:
 *
 *  - 108 MODEM — modem jelas perangkat jaringan. Catatan: 1 dari 3 isinya
 *    (id 1641, adapter Bluetooth Vention) bukan modem; ia ikut pindah karena
 *    yang dipindahkan adalah kategorinya, dan dilaporkan di akhir skrip
 *    supaya bisa ditinjau terpisah.
 *
 *  - 61 KABEL LAN — kabel dan konektor RJ45 adalah barang jaringan. 7 dari 30
 *    isinya USB hub/docking yang kebetulan punya port ethernet; mereka SUDAH
 *    tertaut juga ke `USB HUB` dan `KABEL / CONVERTER`, jadi memindahkan
 *    kategori ini tidak mencabut mereka dari rak aksesoris. Itu sebabnya
 *    pemindahan ini aman: converter tetap ada di dua tempat.
 *
 * TIDAK dipindahkan, meski sempat ditimbang:
 *  - 95 CCTV — belum diputuskan; IP camera bisa dibilang perangkat jaringan,
 *    tapi CCTV analog bukan. Isinya cuma 2 produk, jadi tidak mendesak.
 *  - 63 KABEL HDMI dan kabel lain — tetap di KABEL / CONVERTER. Diminta
 *    eksplisit: yang pindah cuma yang jaringan.
 */
const DIPINDAH: { id: number; alasan: string }[] = [
  { id: 108, alasan: "modem = perangkat jaringan" },
  { id: 61, alasan: "kabel & konektor RJ45 = barang jaringan; USB hub di dalamnya tetap tertaut ke rak aksesoris" },
]

/** Produk yang perlu ditinjau manusia setelah pemindahan. */
const DITANDAI: Record<number, string> = {
  1641: "adapter Bluetooth, bukan modem — ikut pindah karena kategorinya yang pindah",
}

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const url = new URL(cocok[1]!.replace(/^mysql:/, "http:"))

const { getPrisma } = await import("../src/lib/prisma/client")
const { planCategoryMove } = await import("../src/lib/utils/category-move")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.host}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

const semua = await q<{ id: number; name: string; path: string; depth: number; parentId: number | null }>(
  "SELECT id, name, path, depth, parent_id AS parentId FROM categories",
)
const byId = new Map(semua.map((c) => [Number(c.id), { ...c, id: Number(c.id), parentId: c.parentId === null ? null : Number(c.parentId) }]))
const daftar = [...byId.values()]

const tujuan = byId.get(TUJUAN)
if (!tujuan) {
  console.error(`Kategori tujuan id ${TUJUAN} tidak ada.`)
  process.exit(1)
}
console.log(`Tujuan   : "${tujuan.path}" (depth ${tujuan.depth})\n`)

type Rencana = {
  id: number
  nama: string
  pathLama: string
  pathBaru: string
  depthBaru: number
  keturunan: { id: number; oldPath: string; newPath: string; newDepth: number }[]
  produk: number
}

const rencana: Rencana[] = []
const dilewati: { id: number; alasan: string }[] = []

for (const { id, alasan } of DIPINDAH) {
  const kat = byId.get(id)
  if (!kat) {
    dilewati.push({ id, alasan: "kategori tidak ada" })
    continue
  }

  const hasil = planCategoryMove(daftar, id, TUJUAN)
  if (!hasil.ok) {
    dilewati.push({ id, alasan: hasil.error })
    continue
  }

  const jml = Number(
    (
      await q<{ n: bigint }>(
        `SELECT COUNT(DISTINCT pc.product_id) AS n FROM product_categories pc
         JOIN categories c ON c.id = pc.category_id
         WHERE c.id = ? OR c.path LIKE CONCAT(?, ' > %')`,
        id,
        kat.path,
      )
    )[0]!.n,
  )

  rencana.push({
    id,
    nama: kat.name,
    pathLama: hasil.plan.target.oldPath,
    pathBaru: hasil.plan.target.newPath,
    depthBaru: hasil.plan.target.newDepth,
    keturunan: hasil.plan.descendants.map((d) => ({
      id: d.id,
      oldPath: d.oldPath,
      newPath: d.newPath,
      newDepth: d.newDepth,
    })),
    produk: jml,
  })
  void alasan
}

console.log("=== Rencana pemindahan ===")
for (const r of rencana) {
  console.log(`\n  id ${r.id} — "${r.nama}" (${r.produk} produk)`)
  console.log(`    dari : ${r.pathLama}`)
  console.log(`    ke   : ${r.pathBaru}   (depth ${r.depthBaru})`)
  if (r.keturunan.length) {
    console.log(`    keturunan yang ikut disesuaikan: ${r.keturunan.length}`)
    for (const k of r.keturunan) console.log(`      ${k.oldPath}  ->  ${k.newPath}`)
  }
}

if (dilewati.length) {
  console.log("\n=== Dilewati ===")
  for (const d of dilewati) console.log(`  id ${d.id}: ${d.alasan}`)
}

// Produk yang tetap bertaut ke rak lamanya — bukti bahwa "boleh di dua tempat".
if (rencana.length) {
  const ids = rencana.map((r) => r.id)
  const gandaRak = await q<{ id: number; nama: string; lain: string }>(
    `SELECT p.id, p.name AS nama,
            GROUP_CONCAT(DISTINCT c2.path ORDER BY c2.path SEPARATOR ' | ') AS lain
     FROM product_categories pc
     JOIN products p ON p.id = pc.product_id
     JOIN product_categories pc2 ON pc2.product_id = p.id AND pc2.category_id NOT IN (${ids.map(() => "?").join(",")})
     JOIN categories c2 ON c2.id = pc2.category_id
     WHERE pc.category_id IN (${ids.map(() => "?").join(",")})
     GROUP BY p.id, p.name ORDER BY p.id`,
    ...ids,
    ...ids,
  )
  console.log(`\n=== Produk yang TETAP tertaut ke rak lain (${gandaRak.length}) ===`)
  console.log("  Pemindahan kategori tidak mencabut mereka dari sana.")
  for (const g of gandaRak.slice(0, 8)) {
    console.log(`    ${String(g.id).padStart(5)}  ${g.nama.slice(0, 40)}`)
    console.log(`           juga di: ${g.lain}`)
  }
  if (gandaRak.length > 8) console.log(`    ... dan ${gandaRak.length - 8} lagi`)
}

const ditandai = Object.keys(DITANDAI).map(Number)
if (ditandai.length) {
  console.log("\n=== Perlu ditinjau staff setelah ini ===")
  for (const id of ditandai) console.log(`  produk ${id}: ${DITANDAI[id]}`)
}

if (rencana.length === 0) {
  console.log("\nTidak ada yang perlu dipindahkan.")
  await prisma.$disconnect()
  process.exit(0)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar memindahkan.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/pindah-kategori-networking-${stamp}.sql`
writeFileSync(
  berkas,
  `-- ${rencana.length} kategori dipindahkan ke bawah "${tujuan.path}" pada ${stamp}.\n` +
    `-- Jalankan SELURUH berkas ini untuk mengembalikan induk, path, dan depth-nya.\n` +
    `-- Tautan produk tidak pernah disentuh, jadi tidak ada yang perlu dipulihkan di sana.\n\n` +
    `START TRANSACTION;\n\n` +
    rencana
      .flatMap((r) => {
        const kat = byId.get(r.id)!
        const baris = [
          `-- ${r.nama}`,
          `UPDATE categories SET parent_id = ${kat.parentId ?? "NULL"}, ` +
            `path = '${r.pathLama.replace(/'/g, "''")}', depth = ${kat.depth} WHERE id = ${r.id};`,
        ]
        for (const k of r.keturunan) {
          const asli = byId.get(k.id)!
          baris.push(
            `UPDATE categories SET path = '${k.oldPath.replace(/'/g, "''")}', depth = ${asli.depth} WHERE id = ${k.id};`,
          )
        }
        return baris
      })
      .join("\n") +
    `\n\nCOMMIT;\n`,
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}`)

let dipindah = 0
let keturunanDisesuaikan = 0

await prisma.$transaction(async (tx) => {
  for (const r of rencana) {
    await tx.$executeRawUnsafe(
      "UPDATE categories SET parent_id = ?, path = ?, depth = ? WHERE id = ?",
      TUJUAN,
      r.pathBaru,
      r.depthBaru,
      r.id,
    )
    dipindah++
    for (const k of r.keturunan) {
      await tx.$executeRawUnsafe("UPDATE categories SET path = ?, depth = ? WHERE id = ?", k.newPath, k.newDepth, k.id)
      keturunanDisesuaikan++
    }
  }
})

// ------------------------------------------------------------------ verifikasi

const sesudah = await q<{ id: number; path: string; depth: number; parent_id: number | null; jml: bigint }>(
  `SELECT c.id, c.path, c.depth, c.parent_id, COUNT(pc.product_id) AS jml
   FROM categories c LEFT JOIN product_categories pc ON pc.category_id = c.id
   WHERE c.parent_id = ? GROUP BY c.id, c.path, c.depth, c.parent_id ORDER BY jml DESC`,
  TUJUAN,
)

const pathRusak = Number(
  (
    await q<{ n: bigint }>(
      `SELECT COUNT(*) AS n FROM categories c JOIN categories p ON p.id = c.parent_id
       WHERE c.path <> CONCAT(p.path, ' > ', c.name) OR c.depth <> p.depth + 1`,
    )
  )[0]!.n,
)

console.log("\n=== HASIL ===")
console.log(`  kategori dipindah      : ${dipindah}`)
console.log(`  keturunan disesuaikan  : ${keturunanDisesuaikan}`)
console.log(`  anak NETWORK TOOLS kini: ${sesudah.length}`)
console.log(`  path/depth tidak sinkron: ${pathRusak}  (harus 0)`)
console.log(`  hitungan cocok         : ${dipindah === rencana.length && pathRusak === 0 ? "ya" : "TIDAK — periksa!"}`)

console.log("\n=== Isi NETWORK TOOLS sekarang ===")
for (const r of sesudah) console.log(`  ${String(Number(r.jml)).padStart(3)}  ${r.path}`)

await prisma.$disconnect()
