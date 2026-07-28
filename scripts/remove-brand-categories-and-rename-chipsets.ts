/**
 * Task #3 — keluarkan merek & seri dari pohon kategori, lalu perjelas nama
 * kategori chipset.
 *
 * Pohon kategori mencampur dua hal yang berbeda: jenis barang ("LAPTOP OFFICE",
 * "VGA CARD") dan siapa yang membuatnya ("ACER", "ROG", "NVIDIA"). Akibatnya
 * merek jadi tidak bisa dipakai sebagai filter lintas kategori, dan staff harus
 * memilih satu di antara dua sumbu yang sebenarnya saling tegak lurus.
 * Merek sekarang tinggal di kolom `brandId`, jadi cabang-cabang itu bisa
 * dikeluarkan dari pohon.
 *
 * Tiga langkah, berurutan karena langkah 2 bergantung pada langkah 1:
 *
 *   1. Tutup celah brand — kategori SERI (LOQ, Nitro, Victus, ...) tidak pernah
 *      cocok dengan nama merek mana pun, jadi backfill di task #2 melewatinya.
 *      Produk di situ diisi brandId lewat pemetaan seri -> merek induk. Tanpa
 *      langkah ini, langkah 2 menghapus satu-satunya jejak merek mereka.
 *
 *   2. Hapus kategori merek & seri. Produknya tidak jadi yatim: konvensi
 *      penyimpanan menyertakan seluruh jalur leluhur, jadi mereka tetap
 *      memegang "LAPTOP" dan "LAPTOP OFFICE"/"LAPTOP GAMING".
 *
 *   3. Rename kategori chipset mengikuti pola yang sudah dipakai MOTHERBOARD
 *      AMD / MOTHERBOARD INTEL. "VGA CARD > NVIDIA" berisi kartu buatan MSI dan
 *      ASUS — nama polos "NVIDIA" bikin chipset tertukar dengan merek, dan itu
 *      persis yang hampir mengotori 143 produk waktu backfill task #2.
 *      Slug TIDAK diubah supaya URL kategori tidak mati; pembenahan slug
 *      menyeluruh punya taskny sendiri (#4).
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const APPLY = process.argv.includes("--apply")

const base = (process.env.DATABASE_URL as string)
  .replace(/^['"]|['"]$/g, "")
  .replace(/^mysql:\/\//, "mariadb://")
const sep = base.includes("?") ? "&" : "?"
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(`${base}${sep}connectionLimit=2&acquireTimeout=30000`, {
    useTextProtocol: true,
  }),
})

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ")

/** Kategori di bawah dua induk ini seluruhnya merek atau seri laptop. */
const BRAND_CATEGORY_PARENTS = ["LAPTOP > LAPTOP OFFICE", "LAPTOP > LAPTOP GAMING"]

/** Nama kategori -> merek induknya. Seri dipetakan ke pembuatnya. */
const CATEGORY_TO_BRAND = new Map<string, string>([
  // seri
  ["LEGION", "LENOVO"],
  ["LOQ", "LENOVO"],
  ["NITRO", "ACER"],
  ["PREDATOR", "ACER"],
  ["OMEN", "HP"],
  ["VICTUS", "HP"],
  ["PONGO", "AXIOO"],
  ["ROG", "ASUS"],
  ["TUF GAMING", "ASUS"],
  // merek yang namanya memang sudah merek
  ["ACER", "ACER"],
  ["ADVAN", "ADVAN"],
  ["ASUS", "ASUS"],
  ["AXIOO", "AXIOO"],
  ["COLORFUL", "COLORFUL"],
  ["HP", "HP"],
  ["LENOVO", "LENOVO"],
  ["MSI", "MSI"],
])

/** Nama lama -> nama baru untuk kategori chipset. */
const CHIPSET_RENAMES = new Map<string, string>([
  ["KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > NVIDIA", "VGA NVIDIA"],
  ["KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > AMD / ATI RADEON", "VGA AMD RADEON"],
  ["KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > INTEL ARC", "VGA INTEL ARC"],
  ["KOMPONEN PC / NB > PROCESSOR > AMD", "PROCESSOR AMD"],
  ["KOMPONEN PC / NB > PROCESSOR > INTEL", "PROCESSOR INTEL"],
])

async function main() {
  console.log(APPLY ? "*** MODE: APPLY (menulis ke DB) ***" : "--- MODE: DRY RUN (tidak menulis) ---")

  const cats = await prisma.category.findMany({
    select: { id: true, name: true, path: true, slug: true, depth: true, parentId: true },
  })
  const brands = await prisma.brand.findMany({ select: { id: true, name: true } })
  const brandByName = new Map<string, number>()
  for (const b of brands) if (!brandByName.has(norm(b.name))) brandByName.set(norm(b.name), b.id)

  const doomed = cats.filter((c) =>
    BRAND_CATEGORY_PARENTS.some((p) => c.path.startsWith(p + " > ") && c.depth === 3)
  )

  // Kategori yang mau dihapus tidak boleh punya anak — kalau ada, cascade akan
  // ikut menghapus cabang yang belum ditinjau.
  const withChildren = doomed.filter((c) => cats.some((x) => x.parentId === c.id))
  if (withChildren.length > 0) {
    console.error("DIBATALKAN: kategori berikut punya anak, cascade bisa menghapus lebih dari yang dimaksud:")
    for (const c of withChildren) console.error(`   ${c.path}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  // ------------------------------------------------- 1. tutup celah brandId
  const doomedIds = doomed.map((c) => c.id)
  const links = await prisma.productCategory.findMany({
    where: { categoryId: { in: doomedIds } },
    select: { categoryId: true, product: { select: { id: true, wooId: true, name: true, brandId: true } } },
  })

  const catById = new Map(doomed.map((c) => [c.id, c]))
  const fills: { id: number; wooId: number; name: string; brandId: number; via: string }[] = []
  const unmapped: string[] = []

  for (const l of links) {
    if (l.product.brandId !== null) continue
    const cat = catById.get(l.categoryId)!
    const brandName = CATEGORY_TO_BRAND.get(norm(cat.name))
    if (!brandName) {
      unmapped.push(`${cat.path} (woo#${l.product.wooId})`)
      continue
    }
    const brandId = brandByName.get(norm(brandName))
    if (brandId === undefined) {
      unmapped.push(`brand "${brandName}" tidak ada di tabel brands`)
      continue
    }
    fills.push({ id: l.product.id, wooId: l.product.wooId, name: l.product.name, brandId, via: cat.name })
  }

  console.log("\n=== 1. TUTUP CELAH brandId (kategori seri) ===")
  console.log(`  akan diisi: ${fills.length}`)
  for (const f of fills) {
    const bn = brands.find((b) => b.id === f.brandId)?.name
    console.log(`     woo#${f.wooId} ${f.name.slice(0, 48)}`)
    console.log(`        via kategori "${f.via}" -> ${bn}`)
  }
  if (unmapped.length > 0) {
    console.log("  !! tidak terpetakan:")
    for (const u of unmapped) console.log(`     ${u}`)
  }

  // ------------------------------------------------------ 2. hapus kategori
  const linkCount = new Map<number, number>()
  for (const l of links) linkCount.set(l.categoryId, (linkCount.get(l.categoryId) ?? 0) + 1)

  console.log("\n=== 2. HAPUS KATEGORI MEREK & SERI ===")
  console.log(`  ${doomed.length} kategori, ${links.length} kaitan produk ikut terputus`)
  for (const c of doomed.sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`     ${String(linkCount.get(c.id) ?? 0).padStart(4)} produk | ${c.path}`)
  }

  // Pastikan tidak ada produk yang kehilangan seluruh kategorinya.
  const affected = [...new Set(links.map((l) => l.product.id))]
  const survivors = await prisma.productCategory.findMany({
    where: { productId: { in: affected }, categoryId: { notIn: doomedIds } },
    select: { productId: true },
  })
  const stillHave = new Set(survivors.map((s) => s.productId))
  const orphans = affected.filter((id) => !stillHave.has(id))
  console.log(`  produk terdampak: ${affected.length} | jadi tanpa kategori: ${orphans.length}`)
  if (orphans.length > 0) {
    console.error("DIBATALKAN: ada produk yang akan kehilangan seluruh kategorinya.")
    await prisma.$disconnect()
    process.exit(1)
  }

  // ------------------------------------------------------ 3. rename chipset
  const renames = cats
    .filter((c) => CHIPSET_RENAMES.has(c.path))
    .map((c) => {
      const newName = CHIPSET_RENAMES.get(c.path)!
      const parentPath = c.path.slice(0, c.path.lastIndexOf(" > "))
      return { cat: c, newName, newPath: `${parentPath} > ${newName}` }
    })

  console.log("\n=== 3. RENAME KATEGORI CHIPSET ===")
  console.log(`  ${renames.length} dari ${CHIPSET_RENAMES.size} pola cocok`)
  for (const r of renames) {
    console.log(`     "${r.cat.name}" -> "${r.newName}"`)
    console.log(`        path: ${r.newPath}`)
    console.log(`        slug: ${r.cat.slug} (tidak diubah)`)
  }
  const missed = [...CHIPSET_RENAMES.keys()].filter((p) => !cats.some((c) => c.path === p))
  if (missed.length > 0) {
    console.log("  !! path tidak ditemukan:")
    for (const m of missed) console.log(`     ${m}`)
  }
  const renameWithChildren = renames.filter((r) => cats.some((x) => x.parentId === r.cat.id))
  if (renameWithChildren.length > 0) {
    console.error("DIBATALKAN: kategori yang di-rename punya anak; path anak ikut harus diperbarui.")
    await prisma.$disconnect()
    process.exit(1)
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  // ---------------------------------------------------------------- backup
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-categories-${stamp}.json`)
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        deletedCategories: doomed,
        productCategoryLinks: links.map((l) => ({ productId: l.product.id, categoryId: l.categoryId })),
        brandFills: fills.map((f) => ({ productId: f.id, wooId: f.wooId, brandId: f.brandId })),
        renames: renames.map((r) => ({ id: r.cat.id, oldName: r.cat.name, oldPath: r.cat.path })),
      },
      null,
      2
    )
  )
  console.log(`\nbackup ditulis: ${backupPath}`)

  // ----------------------------------------------------------------- tulis
  let filled = 0
  let deleted = 0
  let renamed = 0

  await prisma.$transaction(
    async (tx) => {
      for (const f of fills) {
        const r = await tx.product.updateMany({
          where: { id: f.id, brandId: null },
          data: { brandId: f.brandId },
        })
        filled += r.count
      }

      const d = await tx.category.deleteMany({ where: { id: { in: doomedIds } } })
      deleted = d.count

      for (const r of renames) {
        await tx.category.update({
          where: { id: r.cat.id },
          data: { name: r.newName, path: r.newPath },
        })
        renamed += 1
      }
    },
    { timeout: 120000 }
  )

  console.log(`\nSELESAI. brandId diisi: ${filled} | kategori dihapus: ${deleted} | di-rename: ${renamed}`)
  console.log(`Rollback: ${backupPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
