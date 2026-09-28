/**
 * Membuktikan `getCategories({ hideEmpty: true })` tetap memunculkan kategori
 * induk yang produknya seluruhnya berada di sub-kategori.
 *
 * Memanggil fungsi ASLI dari lapisan data, bukan menyalin kuerinya — salinan
 * SQL hanya menguji ulang pemahaman penulisnya sendiri, dan justru lolos
 * ketika kode sungguhannya yang salah.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-hideempty-networking.mts
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

// `getCategories` membungkus kuerinya dengan `unstable_cache`, yang menuntut
// runtime Next.js dan melempar "incrementalCache missing" dari Node biasa.
// Jadi yang diuji di sini adalah KLAUSA `where`-nya, diimpor dari berkas yang
// sama supaya tetap satu sumber — bukan SQL yang ditulis ulang.
const { hideEmptyWhere } = await import("../src/lib/api/woocommerce/categories")
const { prismaCategoryToWoo } = await import("../src/lib/api/woocommerce/db-mapper")
const { getPrisma: getPrisma0 } = await import("../src/lib/prisma/client")

const kategori = (
  await getPrisma0().category.findMany({
    where: hideEmptyWhere(),
    take: 500,
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  })
).map(prismaCategoryToWoo)
const akar = kategori.filter((c) => c.parent === 0)
const networking = kategori.find((c) => c.slug === "network-tools")
const anakNetworking = kategori.filter((c) => c.parent === 62)

console.log(`\nTotal kategori tampil : ${kategori.length}`)
console.log(`Kategori akar         : ${akar.length}`)
console.log("\n=== Kategori akar yang tampil ===")
for (const c of akar) console.log(`  ${String(c.id).padStart(4)}  ${c.name}  (count: ${c.count})`)

console.log(`\n=== NETWORK TOOLS ===`)
if (networking) {
  console.log(`  TAMPIL — id ${networking.id}, count ${networking.count}`)
  console.log(`  anak yang ikut tampil: ${anakNetworking.length}`)
  for (const a of anakNetworking) console.log(`    ${String(a.id).padStart(4)}  ${a.name}  (${a.count})`)
} else {
  console.log("  HILANG — perbaikan hideEmpty tidak bekerja.")
}

// Kategori yang benar-benar kosong harus TETAP tersaring.
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const benarKosong = await prisma.$queryRawUnsafe<{ id: number; path: string }[]>(
  `SELECT c.id, c.path FROM categories c
   WHERE NOT EXISTS (SELECT 1 FROM product_categories pc WHERE pc.category_id = c.id)
     AND NOT EXISTS (
       SELECT 1 FROM categories d JOIN product_categories pc2 ON pc2.category_id = d.id
       WHERE d.path LIKE CONCAT(c.path, ' > %'))`,
)
const bocor = benarKosong.filter((k) => kategori.some((c) => c.id === Number(k.id)))

console.log(`\n=== Kategori yang benar-benar kosong ===`)
console.log(`  jumlah di database : ${benarKosong.length}`)
console.log(`  bocor ikut tampil  : ${bocor.length}  (harus 0)`)
for (const b of bocor) console.log(`    BOCOR: ${b.path}`)

const lolos = !!networking && bocor.length === 0
console.log(`\n=== ${lolos ? "LOLOS" : "GAGAL"} ===`)

await prisma.$disconnect()
process.exit(lolos ? 0 : 1)
