/**
 * Migrasi #8 tahap 2 — rampingkan akar jadi delapan.
 *
 * Keputusan bentuk pohon datang dari user (29 Juli 2026): NETWORK TOOLS dan
 * SOFTWARE tetap akar; furnitur gaming diperlakukan sebagai furnitur, bukan
 * gaming; PC MINI & DESKTOP, PC ALL IN ONE, dan TABLET & SMARTPHONE masuk
 * kelompok LAPTOP & PC selama skalanya masih kecil.
 *
 * Hasil akhir: KOMPONEN PC / NB, AKSESSORIES KOMPUTER, LAPTOP & PC,
 * PRINTER & PROYEKTOR, NETWORK TOOLS, FURNITURE, SOFTWARE, FIT & HEALTH.
 *
 * Pemindahan kategori tidak menyentuh kaitan produk sama sekali — itu memang
 * desainnya. Tapi konvensi di basis data ini menyimpan leluhur bersama daun,
 * dan halaman /shop mengandalkannya. Jadi setiap pemindahan diikuti perapian
 * kaitan: induk baru ditambahkan, induk lama yang tidak lagi membawahi
 * dilepas. Tanpa itu, kursi gaming akan tetap muncul di AKSESSORIES KOMPUTER
 * setelah pindah ke FURNITURE — persis bentrok yang justru sedang dibereskan.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const {
  createCategory, mergeCategory, previewMergeCategory, moveCategory, renameCategory,
  getCategoriesForAdmin,
} = await import("../src/lib/api/woocommerce/categories")
const { bulkAssignCategory, previewBulkAssignCategory } = await import("../src/lib/api/woocommerce/products")
const { planCategoryMove } = await import("../src/lib/utils/category-move")
const { getPrisma } = await import("../src/lib/prisma/client")

const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"
console.log(`${tag} Rampingkan akar jadi delapan\n`)

const fresh = () => getCategoriesForAdmin()
const need = async (path: string) => {
  const c = (await fresh()).find((x) => x.path === path)
  if (!c) throw new Error(`Kategori tidak ditemukan: ${path}`)
  return c
}
const maybe = async (path: string) => (await fresh()).find((x) => x.path === path)

/** Seluruh wooId produk di dalam subtree sebuah kategori. */
async function productsInSubtree(categoryId: number): Promise<number[]> {
  const all = await fresh()
  const ids = new Set<number>([categoryId])
  let grew = true
  while (grew) {
    grew = false
    for (const c of all) {
      if (c.parentId !== null && ids.has(c.parentId) && !ids.has(c.id)) { ids.add(c.id); grew = true }
    }
  }
  const rows = await p.productCategory.findMany({
    where: { categoryId: { in: [...ids] } },
    select: { product: { select: { wooId: true } } },
  })
  return [...new Set(rows.map((r) => r.product.wooId))]
}

async function fixLinks(label: string, wooIds: number[], addPaths: string[], removePaths: string[]) {
  console.log(`     rapikan kaitan ${label} (${wooIds.length} produk)`)
  for (const path of addPaths) {
    const c = await maybe(path)
    if (!c) { console.log(`       ? tujuan hilang: ${path}`); continue }
    const pv = await previewBulkAssignCategory(wooIds, c.id, "add")
    console.log(`       + ${path}: berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, c.id, "add", pv.willChange)
  }
  for (const path of removePaths) {
    const c = await maybe(path)
    if (!c) { console.log(`       ? sumber hilang: ${path}`); continue }
    const pv = await previewBulkAssignCategory(wooIds, c.id, "remove")
    console.log(`       - ${path}: berubah=${pv.willChange} tanpa_kategori=${pv.wouldBeLeftWithoutCategory} primary=${pv.primaryBeingRemoved}`)
    if (APPLY && pv.wouldBeLeftWithoutCategory > 0) throw new Error(`Menghentikan: ${pv.wouldBeLeftWithoutCategory} produk akan kehabisan kategori.`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, c.id, "remove", pv.willChange)
  }
}

async function move(path: string, parentPath: string | null) {
  const t = await need(path)
  const parent = parentPath === null ? null : await maybe(parentPath)

  // Saat dry run, kategori yang dibuat di langkah sebelumnya belum benar-benar
  // ada. Itu bayangan urutan, bukan kesalahan — laporkan lalu lanjut.
  if (parentPath !== null && !parent) {
    if (!APPLY) { console.log(`     ${path} -> ${parentPath} (tujuan dibuat di langkah sebelumnya)`); return }
    throw new Error(`Kategori tujuan tidak ditemukan: ${parentPath}`)
  }
  const all = (await fresh()).map((c) => ({ id: c.id, name: c.name, path: c.path, depth: c.depth, parentId: c.parentId }))
  const res = planCategoryMove(all, t.id, parent?.id ?? null)
  if (!res.ok) { console.log(`     DITOLAK: ${res.error}`); return }
  console.log(`     ${path} -> ${res.plan.target.newPath} (keturunan ikut: ${res.plan.descendants.length})`)
  if (APPLY) await moveCategory(t.id, parent?.id ?? null)
}

// ---------------------------------------------------------------- 1. merge kembar
console.log("1. Lebur CHARGER PHONE ke POWERBANK & CHARGER (dua kategori, satu arti)")
{
  const src = await maybe("TABLET & SMARTPHONE > CHARGER PHONE")
  const dst = await need("AKSESSORIES KOMPUTER > POWERBANK & CHARGER")
  if (!src) console.log("     sudah tidak ada, dilewati")
  else {
    const pv = await previewMergeCategory(src.id, dst.id)
    console.log(`     pindah=${pv.productsToMove} sudah=${pv.productsAlreadyInTarget} kaitan_lain=${pv.productsWithOtherCategories}`)
    if (APPLY) await mergeCategory(src.id, dst.id, pv.productsToMove)
  }
}

// ---------------------------------------------------------------- 2. rename
console.log("\n2. LAPTOP -> LAPTOP & PC (namanya harus jujur setelah PC masuk)")
{
  const c = await maybe("LAPTOP")
  if (!c) console.log("     sudah bernama lain, dilewati")
  else {
    console.log(`     ${c.path} -> LAPTOP & PC  (slug tetap "${c.slug}")`)
    if (APPLY) await renameCategory(c.id, "LAPTOP & PC")
  }
}
const LAPTOP_PC = APPLY ? "LAPTOP & PC" : "LAPTOP"

// ---------------------------------------------------------------- 3. FURNITURE
console.log("\n3. Buat akar FURNITURE")
{
  const ada = await maybe("FURNITURE")
  if (ada) console.log("     sudah ada, dilewati")
  else {
    console.log("     buat kategori utama FURNITURE")
    if (APPLY) await createCategory("FURNITURE", null)
  }
}

// ---------------------------------------------------------------- 4. pemindahan
console.log("\n4. Pindahkan kategori ke induk barunya")

console.log("\n   a. WEBCAM -> AKSESSORIES KOMPUTER")
{
  const wooIds = await productsInSubtree((await need("WEBCAM")).id)
  await move("WEBCAM", "AKSESSORIES KOMPUTER")
  await fixLinks("WEBCAM", wooIds, ["AKSESSORIES KOMPUTER"], [])
}

console.log(`\n   b. PC MINI & DESKTOP -> ${LAPTOP_PC}`)
{
  const wooIds = await productsInSubtree((await need("PC MINI & DESKTOP")).id)
  await move("PC MINI & DESKTOP", LAPTOP_PC)
  await fixLinks("PC MINI & DESKTOP", wooIds, [LAPTOP_PC], [])
}

console.log(`\n   c. PC ALL IN ONE -> ${LAPTOP_PC}`)
{
  const wooIds = await productsInSubtree((await need("PC ALL IN ONE")).id)
  await move("PC ALL IN ONE", LAPTOP_PC)
  await fixLinks("PC ALL IN ONE", wooIds, [LAPTOP_PC], [])
}

console.log(`\n   d. TABLET & SMARTPHONE -> ${LAPTOP_PC}`)
{
  const wooIds = await productsInSubtree((await need("TABLET & SMARTPHONE")).id)
  await move("TABLET & SMARTPHONE", LAPTOP_PC)
  await fixLinks("TABLET & SMARTPHONE", wooIds, [LAPTOP_PC], [])
}

console.log("\n   e. HANDHELD GAMING DEVICE -> AKSESSORIES KOMPUTER > KONSOL GAME")
{
  const wooIds = await productsInSubtree((await need("HANDHELD GAMING DEVICE")).id)
  await move("HANDHELD GAMING DEVICE", "AKSESSORIES KOMPUTER > KONSOL GAME")
  await fixLinks("HANDHELD", wooIds, ["AKSESSORIES KOMPUTER", "AKSESSORIES KOMPUTER > KONSOL GAME"], [])
}

console.log("\n   f. KURSI GAMING & MEJA GAMING -> FURNITURE")
for (const nama of ["KURSI GAMING", "MEJA GAMING"]) {
  const src = await maybe(`AKSESSORIES KOMPUTER > ${nama}`)
  if (!src) { console.log(`     ${nama}: sudah pindah, dilewati`); continue }
  const wooIds = await productsInSubtree(src.id)
  await move(`AKSESSORIES KOMPUTER > ${nama}`, "FURNITURE")
  // Induk lama dilepas: kalau tidak, furnitur tetap terdaftar di AKSESSORIES
  // KOMPUTER dan bentrok yang sedang dibereskan justru diawetkan.
  await fixLinks(nama, wooIds, ["FURNITURE"], ["AKSESSORIES KOMPUTER"])
}

console.log("\n=== AKAR SESUDAHNYA ===")
const roots = (await fresh()).filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name))
console.log("  " + roots.map((r) => r.name).join(", "))
console.log(`  jumlah akar: ${roots.length}`)

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
