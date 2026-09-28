/**
 * Memeriksa daftar kategori yang BENAR-BENAR diserahkan Header ke MegaMenu.
 *
 * Kenapa tidak mengukur lewat HTML halaman saja: MegaMenu komponen klien, jadi
 * kategorinya masuk lewat payload RSC yang ter-escape — `grep` atasnya tidak
 * bisa membedakan "berhasil disaring" dari "formatnya berbeda". Keduanya sama
 * -sama nol, dan yang kedua diam-diam lolos sebagai bukti palsu.
 *
 * Jadi yang ditiru di sini adalah dua langkah persis milik `Header()`:
 * pembacaan `getCategories({ hideEmpty: true, perPage: 500 })` lalu penyaringan
 * `SLUG_TERSEMBUNYI_DI_MENU`. Daftar slug yang disembunyikan DIBACA dari
 * `header.tsx` itu sendiri, bukan disalin ke sini — kalau seseorang mengubah
 * daftarnya di sana, uji ini ikut berubah alih-alih diam-diam menguji nilai
 * yang sudah usang.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-menu-header.mts
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync } from "node:fs"

const { hideEmptyWhere } = await import("../src/lib/api/woocommerce/categories")
const { buildCategoryTree } = await import("../src/lib/utils/category-tree")
const { prismaCategoryToWoo } = await import("../src/lib/api/woocommerce/db-mapper")
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

// --- daftar slug tersembunyi, dibaca dari header.tsx ---------------------

const header = readFileSync("src/components/layout/header.tsx", "utf8")
const cocok = header.match(/const SLUG_TERSEMBUNYI_DI_MENU = \[([^\]]*)\]/)
if (!cocok) {
  console.error("SLUG_TERSEMBUNYI_DI_MENU tidak ditemukan di header.tsx")
  process.exit(1)
}
const tersembunyi = [...cocok[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!)

if (!header.includes("categories={categoriesMenu}")) {
  console.error("MegaMenu tidak menerima `categoriesMenu` — penyaringnya tidak terpasang.")
  process.exit(1)
}

console.log(`\nSlug disembunyikan dari menu : ${tersembunyi.join(", ")}\n`)

// --- tiru Header(): baca lalu saring -------------------------------------

const semua = (
  await prisma.category.findMany({
    where: hideEmptyWhere(),
    take: 500,
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  })
).map(prismaCategoryToWoo)

const menu = semua.filter((c) => !tersembunyi.includes(c.slug))
const pohon = buildCategoryTree(menu)

const gagal: string[] = []

console.log("=== Isi dropdown KATEGORI ===")
for (const akar of pohon) {
  console.log(`\n  ${akar.title}`)
  for (const anak of akar.children) console.log(`    - ${anak.title}`)
  if (akar.children.length === 0) console.log("    (tanpa sub-kategori)")
}

// --- yang wajib benar ----------------------------------------------------

for (const slug of tersembunyi) {
  const asli = semua.find((c) => c.slug === slug)
  if (!asli) {
    gagal.push(`slug "${slug}" tidak ada di katalog — daftar di header.tsx sudah usang`)
    continue
  }
  const bocor = pohon.some((a) => a.children.some((k) => k.id === asli.id) || a.id === asli.id)
  if (bocor) gagal.push(`"${asli.name}" MASIH tampil di menu`)
  else console.log(`\n  OK   "${asli.name}" tidak muncul di menu`)
}

// Induknya harus tetap ada beserta saudara-saudaranya.
const laptopPc = pohon.find((a) => a.id === 1)
if (!laptopPc) gagal.push('"LAPTOP & PC" hilang dari menu')
else console.log(`  OK   "LAPTOP & PC" tetap ada dengan ${laptopPc.children.length} sub-kategori`)

// Kategori akar tidak boleh berkurang gara-gara penyaringan ini.
const akarSemua = semua.filter((c) => c.parent === 0).length
if (pohon.length !== akarSemua) gagal.push(`kategori akar berkurang: ${pohon.length} vs ${akarSemua}`)
else console.log(`  OK   ${pohon.length} kategori akar, tidak ada yang ikut hilang`)

// NETWORK TOOLS beserta sub-kategorinya harus utuh.
const nt = pohon.find((a) => a.title === "NETWORK TOOLS")
if (!nt) gagal.push("NETWORK TOOLS hilang dari menu")
else if (nt.children.length !== 12) gagal.push(`NETWORK TOOLS punya ${nt.children.length} sub, harusnya 12`)
else console.log(`  OK   NETWORK TOOLS utuh dengan ${nt.children.length} sub-kategori`)

if (gagal.length) {
  console.log("\n=== GAGAL ===")
  for (const g of gagal) console.log(`  X    ${g}`)
}
console.log(`\n=== ${gagal.length === 0 ? "SEMUA LOLOS" : `${gagal.length} GAGAL`} ===`)

await prisma.$disconnect()
process.exit(gagal.length === 0 ? 0 : 1)
