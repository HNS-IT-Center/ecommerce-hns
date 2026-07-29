/**
 * Migrasi #8 tahap 1 — bubarkan kategori yang sebenarnya merek.
 *
 * Prinsip "brand dipisahkan dari category" sudah disepakati, tapi pembersihan
 * 916a541 melewatkan cabang printer dan dua akar. Kategori-kategori ini murni
 * duplikasi: seluruh produknya sudah punya `brandId`, jadi identitas mereknya
 * tidak hilang ke mana-mana.
 *
 * Kategori printer per merek dan PLAYSTATION tidak memindahkan satu produk pun
 * — produknya sudah memegang kaitan ke kategori fungsionalnya. Yang menuntut
 * kehati-hatian justru APPLE: isinya bukan laptop semua. Ada satu iPad yang
 * tidak punya kategori lain sama sekali, dan satu kabel MagSafe yang sudah
 * benar berada di KABEL USB A-C. Merge buta akan mengarsipkan keduanya sebagai
 * laptop, jadi keduanya dibereskan satu per satu lebih dulu.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { mergeCategory, previewMergeCategory, getCategoriesForAdmin } =
  await import("../src/lib/api/woocommerce/categories")
const { bulkAssignCategory, previewBulkAssignCategory } =
  await import("../src/lib/api/woocommerce/products")
const { getPrisma } = await import("../src/lib/prisma/client")

const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

const cats = await getCategoriesForAdmin()
const byPath = (path: string) => {
  const c = cats.find((x) => x.path === path)
  if (!c) throw new Error(`Kategori tidak ditemukan: ${path}`)
  return c
}

const APPLE = byPath("APPLE")
const MACBOOK = byPath("APPLE > MACBOOK")
const LAPTOP = byPath("LAPTOP")
const LAPTOP_OFFICE = byPath("LAPTOP > LAPTOP OFFICE")
const TABLET = byPath("TABLET & SMARTPHONE")

const wooOf = async (namePart: string) => {
  const rows = await p.product.findMany({
    where: { name: { contains: namePart } },
    select: { wooId: true, name: true },
  })
  return rows
}

console.log(`${tag} Migrasi kategori merek\n`)

// ---------------------------------------------------------------- 1. iPad
const ipads = await wooOf("IPAD APPLE 11 2025")
console.log(`1. iPad (${ipads.length} produk) -> TABLET & SMARTPHONE`)
for (const r of ipads) console.log(`     ${r.name}`)
if (ipads.length !== 1) throw new Error("Diharapkan tepat 1 iPad; hentikan supaya tidak salah sasaran.")
{
  const ids = ipads.map((r) => r.wooId)
  const pv = await previewBulkAssignCategory(ids, TABLET.id, "add")
  console.log(`     berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
  if (APPLY && pv.willChange > 0) await bulkAssignCategory(ids, TABLET.id, "add", pv.willChange)
}

// ------------------------------------------------- 2. kabel MagSafe MCDODO
const kabel = await wooOf("MCDODO KABEL MAGSAFE MACBOOK")
console.log(`\n2. Kabel MagSafe (${kabel.length} produk) -> lepas dari APPLE & MACBOOK`)
for (const r of kabel) console.log(`     ${r.name}`)
if (kabel.length !== 1) throw new Error("Diharapkan tepat 1 kabel MagSafe; hentikan.")
{
  const ids = kabel.map((r) => r.wooId)
  for (const cat of [APPLE, MACBOOK]) {
    const pv = await previewBulkAssignCategory(ids, cat.id, "remove")
    console.log(`     lepas dari ${cat.path}: berubah=${pv.willChange} tanpa_kategori=${pv.wouldBeLeftWithoutCategory}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(ids, cat.id, "remove", pv.willChange)
  }
}

// ------------------------------------------- 3. iPad dilepas dari APPLE
console.log(`\n3. iPad -> lepas dari APPLE (sudah punya TABLET & SMARTPHONE)`)
{
  const ids = ipads.map((r) => r.wooId)
  const pv = await previewBulkAssignCategory(ids, APPLE.id, "remove")
  console.log(`     berubah=${pv.willChange} tanpa_kategori=${pv.wouldBeLeftWithoutCategory}`)
  // Saat dry run, langkah 1 belum benar-benar menulis, jadi iPad memang masih
  // terlihat akan kehabisan kategori — itu bayangan urutan, bukan bahaya.
  // Saat --apply, langkah 1 sudah nyata, sehingga angka ini harus nol.
  if (APPLY && pv.wouldBeLeftWithoutCategory > 0) {
    throw new Error("iPad akan kehabisan kategori — hentikan.")
  }
  if (APPLY && pv.willChange > 0) await bulkAssignCategory(ids, APPLE.id, "remove", pv.willChange)
}

// ------------------------------------ 4. MacBook dapat jalur LAPTOP penuh
console.log(`\n4. MacBook -> pastikan punya LAPTOP dan LAPTOP > LAPTOP OFFICE`)
{
  const macLinks = await p.productCategory.findMany({
    where: { categoryId: MACBOOK.id },
    select: { product: { select: { wooId: true, name: true } } },
  })
  const ids = macLinks
    .map((l) => l.product.wooId)
    .filter((id) => !kabel.some((k) => k.wooId === id))
  console.log(`     ${ids.length} MacBook`)
  for (const cat of [LAPTOP, LAPTOP_OFFICE]) {
    const pv = await previewBulkAssignCategory(ids, cat.id, "add")
    console.log(`     tambah ${cat.path}: berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(ids, cat.id, "add", pv.willChange)
  }
}

// --------------------------------------------------- 5. merge kategori merek
const merges: Array<[string, string]> = [
  ["PRINTER & PROYEKTOR > PRINTER EPSON", "PRINTER & PROYEKTOR"],
  ["PRINTER & PROYEKTOR > PRINTER BROTHER", "PRINTER & PROYEKTOR"],
  ["PRINTER & PROYEKTOR > PRINTER HP", "PRINTER & PROYEKTOR"],
  ["PRINTER & PROYEKTOR > PRINTER CANON", "PRINTER & PROYEKTOR"],
  ["PLAYSTATION", "AKSESSORIES KOMPUTER > KONSOL GAME"],
  ["APPLE > MACBOOK", "LAPTOP > LAPTOP OFFICE"],
  ["APPLE", "LAPTOP > LAPTOP OFFICE"],
]

console.log(`\n5. Gabungkan kategori merek ke kategori fungsionalnya`)
for (const [srcPath, dstPath] of merges) {
  const fresh = await getCategoriesForAdmin()
  const src = fresh.find((c) => c.path === srcPath)
  const dst = fresh.find((c) => c.path === dstPath)
  if (!src) { console.log(`   - ${srcPath}: sudah tidak ada, dilewati`); continue }
  if (!dst) throw new Error(`Tujuan tidak ditemukan: ${dstPath}`)

  try {
    const pv = await previewMergeCategory(src.id, dst.id)
    console.log(`   - ${srcPath} -> ${dstPath}: pindah=${pv.productsToMove} sudah=${pv.productsAlreadyInTarget}`)
    if (APPLY) await mergeCategory(src.id, dst.id, pv.productsToMove)
  } catch (e) {
    console.log(`   - ${srcPath}: DITOLAK ${(e as Error).message}`)
    if (APPLY) throw e
  }
}

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
