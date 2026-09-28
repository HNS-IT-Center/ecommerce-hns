/**
 * LAPORAN SAJA — tidak menulis apa pun, tidak punya mode --tulis.
 *
 * Satu produk, satu keputusan: TP-LINK UB500 (id 1720) adalah adapter
 * Bluetooth murni tanpa Wi-Fi sama sekali, tapi duduk di `NETWORK TOOLS`.
 *
 * Skrip ini tidak memutuskan apa pun. Ia mengumpulkan yang perlu dilihat
 * sebelum memutuskan — di mana barang Bluetooth sejenis tinggal, dan apa
 * saja tetangga UB500 sekarang — lalu mencetak perintah SQL untuk tiap
 * pilihan supaya keputusannya bisa langsung dijalankan.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/laporan-produk-1720-bluetooth.mts
 *
 * Kenapa laporan dan bukan skrip: memindahkan SATU produk lewat skrip
 * ber-backup adalah upacara yang lebih besar daripada tindakannya. Yang
 * mahal di sini bukan eksekusinya, melainkan memutuskan ke mana — dan itu
 * butuh mata orang yang tahu bagaimana pelanggan HNS mencari barang.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync } from "node:fs"

const PRODUK = 1720
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

const p = (
  await q<{ id: number; nama: string; status: string; brand: string | null; harga: string | null }>(
    `SELECT p.id, p.name AS nama, p.status, b.name AS brand, p.regular_price AS harga
     FROM products p LEFT JOIN brands b ON b.id = p.brand_id WHERE p.id = ?`,
    PRODUK,
  )
)[0]

if (!p) {
  console.error(`Produk ${PRODUK} tidak ada.`)
  await prisma.$disconnect()
  process.exit(1)
}

console.log("=== Produk yang dipersoalkan ===")
console.log(`  id     : ${p.id}`)
console.log(`  nama   : ${p.nama}`)
console.log(`  status : ${p.status}`)
console.log(`  brand  : ${p.brand ?? "(kosong)"}`)
console.log(`  harga  : ${p.harga ?? "(kosong)"}`)

const kategoriSekarang = await q<{ id: number; path: string; is_primary: number }>(
  `SELECT c.id, c.path, pc.is_primary FROM product_categories pc
   JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = ? ORDER BY c.path`,
  PRODUK,
)
console.log("\n=== Kategorinya sekarang ===")
for (const c of kategoriSekarang) {
  console.log(`  id ${String(c.id).padStart(4)}  ${c.path}${Number(c.is_primary) ? "  [PRIMARY]" : ""}`)
}
if (kategoriSekarang.every((c) => !Number(c.is_primary))) {
  console.log("  (tidak ada yang ditandai primary)")
}

// Di mana barang Bluetooth lain tinggal?
const rumahBluetooth = await q<{ id: number; path: string; jml: bigint }>(
  `SELECT c.id, c.path, COUNT(*) AS jml
   FROM products x JOIN product_categories pc ON pc.product_id = x.id
   JOIN categories c ON c.id = pc.category_id
   WHERE UPPER(x.name) LIKE '%BLUETOOTH%' AND x.id <> ?
   GROUP BY c.id, c.path ORDER BY jml DESC LIMIT 10`,
  PRODUK,
)
console.log("\n=== Di mana barang Bluetooth LAIN tinggal ===")
for (const r of rumahBluetooth) {
  console.log(`  ${String(Number(r.jml)).padStart(3)}  id ${String(r.id).padStart(4)}  ${r.path}`)
}

// Barang Bluetooth yang juga di NETWORK TOOLS — teman senasib UB500.
const btDiNetwork = await q<{ id: number; nama: string }>(
  `SELECT x.id, x.name AS nama FROM products x
   JOIN product_categories pc ON pc.product_id = x.id
   WHERE pc.category_id = ? AND UPPER(x.name) LIKE '%BLUETOOTH%' ORDER BY x.id`,
  NETWORK,
)
console.log(`\n=== Barang Bluetooth di NETWORK TOOLS (${btDiNetwork.length}) ===`)
for (const b of btDiNetwork) {
  const murni = !/WI-?FI|WIRELESS N|AC\d{3}|AX\d{3}/i.test(b.nama)
  console.log(`  ${String(b.id).padStart(5)}  ${b.nama.slice(0, 56)}${murni ? "   <- Bluetooth MURNI" : ""}`)
}

const aksesoris = await q<{ id: number; path: string }>(
  `SELECT id, path FROM categories WHERE path LIKE 'AKSESSORIES KOMPUTER%' AND depth = 1`,
)

console.log(`
=== Pertimbangan ===

  5 dari ${btDiNetwork.length} barang Bluetooth di NETWORK TOOLS adalah adapter gabungan
  Wi-Fi + Bluetooth — barang jaringan yang kebetulan punya Bluetooth. Hanya
  UB500 yang Bluetooth murni: ia tidak menyambungkan apa pun ke jaringan.

  Membuat sub-kategori "Adapter Bluetooth" untuk satu produk tidak sepadan —
  rak berisi satu barang terlihat seperti kesalahan, bukan pilihan.

  Jadi pilihannya dua, dan keduanya bisa dibenarkan:

  A. BIARKAN di NETWORK TOOLS > Adapter WiFi & Bluetooth.
     Alasannya: pelanggan yang mencari "USB adapter bluetooth" kemungkinan
     besar menelusuri rak yang sama dengan adapter Wi-Fi USB — bentuk, harga,
     dan cara pakainya mirip.

  B. PINDAHKAN ke AKSESSORIES KOMPUTER.
     Alasannya: secara kategori barang, ia aksesori USB, bukan perangkat
     jaringan. Konsisten dengan ${rumahBluetooth[0] ? Number(rumahBluetooth[0].jml) : "puluhan"} barang Bluetooth lain yang sudah di sana.

  Saya condong ke A: rak ditata menurut cara orang mencari, bukan menurut
  ketepatan taksonomi. Tapi ini keputusan rasa, dan itu milikmu.
`)

console.log("=== Kalau memilih B, perintahnya ===\n")
const tujuan = aksesoris[0]
if (tujuan) {
  console.log(`  -- pindah dari NETWORK TOOLS (${NETWORK}) ke ${tujuan.path} (${tujuan.id})`)
  console.log(`  START TRANSACTION;`)
  console.log(
    `  INSERT IGNORE INTO product_categories (product_id, category_id, is_primary) VALUES (${PRODUK}, ${tujuan.id}, 1);`,
  )
  console.log(`  DELETE FROM product_categories WHERE product_id = ${PRODUK} AND category_id = ${NETWORK};`)
  console.log(`  COMMIT;`)
  console.log(`\n  -- untuk mengembalikan:`)
  console.log(
    `  INSERT IGNORE INTO product_categories (product_id, category_id, is_primary) VALUES (${PRODUK}, ${NETWORK}, 0);`,
  )
  console.log(`  DELETE FROM product_categories WHERE product_id = ${PRODUK} AND category_id = ${tujuan.id};`)
} else {
  console.log("  (kategori AKSESSORIES KOMPUTER tidak ditemukan)")
}

console.log(`
  Atau lewat /admin/produk/${PRODUK} — lebih aman, karena panel mengurus
  is_primary dan revalidasi cache sekaligus.
`)

await prisma.$disconnect()
