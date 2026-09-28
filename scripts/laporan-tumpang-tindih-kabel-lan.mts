/**
 * LAPORAN SAJA — tidak menulis apa pun, tidak punya mode --tulis.
 *
 * Memetakan tumpang tindih antara `AKSESSORIES KOMPUTER > KABEL / CONVERTER >
 * KABEL LAN` (id 61) dan `NETWORK TOOLS` (id 62), supaya keputusan melebur
 * atau tidak diambil setelah melihat isinya — bukan dari dugaan "dua kategori
 * ini kedengarannya sama".
 *
 * Kenapa perlu dilihat dulu: dari luar, id 61 tampak kembaran dari rencana
 * sub-kategori "Konektor & Kabel LAN" di bawah id 62. Setelah dibaca isinya,
 * 30 produk di id 61 ternyata tiga jenis barang yang berbeda — kabel patch,
 * konektor RJ45, dan USB hub/docking yang kebetulan punya port ethernet.
 * Yang terakhir itu bukan barang jaringan; ia aksesori USB. Melebur id 61
 * bulat-bulat ke NETWORK TOOLS akan menyeret belasan docking station ke sana.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/laporan-tumpang-tindih-kabel-lan.mts
 *
 * Penggolongan di bawah memakai kata kunci dan SENGAJA kasar — ia alat bantu
 * baca, bukan dasar pemindahan. Yang memutuskan tetap orang.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync } from "node:fs"

const KABEL_LAN = 61
const NETWORK = 62

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const url = new URL(cocok[1]!.replace(/^mysql:/, "http:"))

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${url.pathname.slice(1)} @ ${url.host}`)
console.log(`Mode     : LAPORAN — tidak menulis apa pun\n`)

type Baris = { id: number; nama: string; status: string; di62: number }

const isi = await q<Baris>(
  `SELECT p.id, p.name AS nama, p.status,
          EXISTS(SELECT 1 FROM product_categories x WHERE x.product_id = p.id AND x.category_id = ?) AS di62
   FROM product_categories pc JOIN products p ON p.id = pc.product_id
   WHERE pc.category_id = ? ORDER BY p.name`,
  NETWORK,
  KABEL_LAN,
)

/** Penggolongan kasar untuk membaca, bukan untuk memindahkan. */
function golong(nama: string): "kabel" | "konektor" | "hub/docking" | "lain" {
  const n = nama.toUpperCase()
  if (/HUB|DOCKING|DOCK\b|\d+-?IN-?\d+|\bCONVERTER\b/.test(n)) return "hub/docking"
  if (/RJ45|CONNECTOR|KONEKTOR|KEYSTONE|SPLITTER|\bPLUG\b|PCS/.test(n)) return "konektor"
  if (/KABEL|CABLE|PATCH/.test(n)) return "kabel"
  return "lain"
}

const kelompok = new Map<string, Baris[]>()
for (const b of isi) {
  const g = golong(b.nama)
  if (!kelompok.has(g)) kelompok.set(g, [])
  kelompok.get(g)!.push(b)
}

console.log(`=== Isi "KABEL LAN" (id ${KABEL_LAN}) — ${isi.length} produk ===\n`)
for (const [g, baris] of [...kelompok].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${g.toUpperCase()} — ${baris.length} produk`)
  for (const b of baris) {
    const tanda = Number(b.di62) ? " [JUGA DI NETWORK TOOLS]" : ""
    const st = b.status === "PUBLISHED" ? "" : ` (${b.status})`
    console.log(`    ${String(b.id).padStart(5)}  ${b.nama.replace(/\r?\n/g, " ").slice(0, 60)}${st}${tanda}`)
  }
  console.log("")
}

const tumpang = isi.filter((b) => Number(b.di62))
const hub = kelompok.get("hub/docking") ?? []
const kabel = kelompok.get("kabel") ?? []
const konektor = kelompok.get("konektor") ?? []

console.log("=== Ringkasan ===")
console.log(`  total di KABEL LAN          : ${isi.length}`)
console.log(`  tumpang tindih di NETWORK   : ${tumpang.length}`)
console.log(`  kabel patch (barang kabel)  : ${kabel.length}`)
console.log(`  konektor RJ45               : ${konektor.length}`)
console.log(`  USB hub / docking / adapter : ${hub.length}  <- BUKAN barang jaringan`)

console.log(`
=== Kenapa "lebur saja" bukan jawabannya ===

  ${hub.length} dari ${isi.length} produk di KABEL LAN adalah USB hub, docking station, dan
  converter yang kebetulan punya port RJ45. Memindahkan seluruh isi id ${KABEL_LAN}
  ke NETWORK TOOLS akan menaruh docking station USB-C di rak jaringan.

  Sebaliknya, kabel patch dan konektor RJ45 memang barang jaringan — tapi
  pelanggan yang mencari kabel LAN kemungkinan besar menelusuri lewat
  AKSESSORIES > KABEL, bukan NETWORK TOOLS.

  Produk boleh berada di dua kategori sekaligus; yang menentukan breadcrumb
  dan URL kanonik adalah is_primary. Jadi tumpang tindih ${tumpang.length} produk itu
  sendiri BUKAN kerusakan — yang perlu dipastikan hanya: setiap produk punya
  tepat satu is_primary, dan primary-nya masuk akal.
`)

const tanpaPrimary = await q<{ id: number; nama: string }>(
  `SELECT p.id, p.name AS nama FROM products p
   WHERE p.id IN (SELECT product_id FROM product_categories WHERE category_id IN (?, ?))
     AND NOT EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.is_primary = 1)
   ORDER BY p.id`,
  KABEL_LAN,
  NETWORK,
)

console.log(`=== Produk di kedua kategori yang TIDAK punya is_primary sama sekali ===`)
console.log(`  ${tanpaPrimary.length} produk\n`)
for (const b of tanpaPrimary.slice(0, 20)) {
  console.log(`    ${String(b.id).padStart(5)}  ${b.nama.replace(/\r?\n/g, " ").slice(0, 62)}`)
}
if (tanpaPrimary.length > 20) console.log(`    ... dan ${tanpaPrimary.length - 20} lagi`)

console.log(`
  Tanpa is_primary, breadcrumb dan URL kanonik produk itu tidak punya jawaban
  pasti. Ini yang layak dibereskan lebih dulu — bukan struktur kategorinya.
`)

await prisma.$disconnect()
