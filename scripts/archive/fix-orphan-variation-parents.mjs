// Perbaiki VARIATION yang parent_id-nya NULL (bug dari import batch original
// 2026-07-23 - variasi kemungkinan diproses sebelum induknya sempat dibuat).
// Resolve parent yang benar lewat wp_posts.post_parent di raw dump WordPress.
import mariadb from "mariadb"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

async function main() {
  if (!process.env.RAW_DUMP_DATABASE_URL) {
    console.error("RAW_DUMP_DATABASE_URL belum diisi di .env.local")
    process.exit(1)
  }
  const rawUrl = new URL(process.env.RAW_DUMP_DATABASE_URL.replace(/^['"]|['"]$/g, ""))
  const raw = await mariadb.createConnection({
    host: rawUrl.hostname, port: Number(rawUrl.port) || 3306,
    user: decodeURIComponent(rawUrl.username), password: decodeURIComponent(rawUrl.password),
    database: rawUrl.pathname.slice(1), connectTimeout: 20000,
  })

  const prismaUrl = new URL(process.env.DATABASE_URL.replace(/^['"]|['"]$/g, ""))
  const prisma = await mariadb.createConnection({
    host: prismaUrl.hostname, port: Number(prismaUrl.port) || 3306,
    user: decodeURIComponent(prismaUrl.username), password: decodeURIComponent(prismaUrl.password),
    database: prismaUrl.pathname.slice(1), connectTimeout: 15000,
  })

  const orphans = await prisma.query("SELECT id, woo_id FROM products WHERE type='VARIATION' AND parent_id IS NULL")
  console.log(`Variasi tanpa parent: ${orphans.length}`)

  const wooIds = orphans.map(o => Number(o.woo_id))
  const placeholders = wooIds.map(() => "?").join(",")
  const postParents = await raw.query(
    `SELECT ID, post_parent FROM wp_posts WHERE ID IN (${placeholders})`,
    wooIds
  )
  const parentWooIdByVariationWooId = new Map(postParents.map(p => [Number(p.ID), Number(p.post_parent)]))

  const allProducts = await prisma.query("SELECT id, woo_id FROM products")
  const idByWooId = new Map(allProducts.map(p => [Number(p.woo_id), p.id]))

  let fixed = 0
  const unresolved = []

  for (const o of orphans) {
    const variationWooId = Number(o.woo_id)
    const parentWooId = parentWooIdByVariationWooId.get(variationWooId)
    const parentId = parentWooId ? idByWooId.get(parentWooId) : undefined

    if (!parentId) {
      unresolved.push({ variationId: o.id, variationWooId, parentWooId })
      continue
    }

    await prisma.query("UPDATE products SET parent_id = ? WHERE id = ?", [parentId, o.id])
    fixed += 1
  }

  console.log(`Berhasil diperbaiki: ${fixed}`)
  console.log(`Tidak bisa di-resolve: ${unresolved.length}`)
  for (const u of unresolved) console.log(`  variation id=${u.variationId} woo_id=${u.variationWooId} -> parentWooId=${u.parentWooId} (parent tidak ketemu di Prisma DB)`)

  await raw.end()
  await prisma.end()
}

main().catch(e => { console.error(e); process.exit(1) })
