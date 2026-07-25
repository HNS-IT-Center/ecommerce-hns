// Perbaiki data produk yang rusak dari import batch original (2026-07-23):
// - nama terpotong (kebanyakan gara-gara "&amp;" mematahkan parsing CSV lama)
// - harga NULL padahal WordPress asli punya harga
// - status salah (private/publish WooCommerce ke-mapping jadi DRAFT)
// Sumber kebenaran: raw dump WordPress (wp_posts + wp_postmeta), bukan CSV lama.
import mariadb from "mariadb"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const DRY_RUN = process.argv.includes("--dry-run")

function mapStatus(postStatus) {
  if (postStatus === "publish") return "PUBLISHED"
  if (postStatus === "private") return "PRIVATE"
  if (postStatus === "draft") return "DRAFT"
  return null // trash/auto-draft/lainnya - jangan disentuh
}

async function main() {
  const rawUrl = new URL(process.env.RAW_DUMP_DATABASE_URL.replace(/^['"]|['"]$/g, ""))
  const raw = await mariadb.createConnection({
    host: rawUrl.hostname, port: Number(rawUrl.port) || 3306,
    user: decodeURIComponent(rawUrl.username), password: decodeURIComponent(rawUrl.password),
    database: rawUrl.pathname.slice(1), connectTimeout: 20000,
  })
  const pu = new URL(process.env.DATABASE_URL.replace(/^['"]|['"]$/g, ""))
  const prisma = await mariadb.createConnection({
    host: pu.hostname, port: Number(pu.port) || 3306,
    user: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password),
    database: pu.pathname.slice(1), connectTimeout: 15000,
  })

  const ours = await prisma.query("SELECT id, woo_id, type, status, name, slug, regular_price, sale_price, stock_status FROM products")
  const wooIds = ours.map(r => Number(r.woo_id))
  const chunks = []
  for (let i = 0; i < wooIds.length; i += 2000) chunks.push(wooIds.slice(i, i + 2000))

  const rawPosts = new Map()
  const rawMeta = new Map()
  for (const chunk of chunks) {
    const placeholders = chunk.map(() => "?").join(",")
    const posts = await raw.query(`SELECT ID, post_title, post_status FROM wp_posts WHERE ID IN (${placeholders})`, chunk)
    for (const r of posts) rawPosts.set(Number(r.ID), r)

    const metaRows = await raw.query(
      `SELECT post_id, meta_key, meta_value FROM wp_postmeta WHERE post_id IN (${placeholders}) AND meta_key IN ('_regular_price','_sale_price','_stock_status')`,
      chunk
    )
    for (const r of metaRows) {
      const pid = Number(r.post_id)
      if (!rawMeta.has(pid)) rawMeta.set(pid, {})
      rawMeta.get(pid)[r.meta_key] = r.meta_value
    }
  }

  function slugify(s) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
  }

  let nameFixed = 0
  let priceFixed = 0
  let statusFixed = 0
  const errors = []

  for (const p of ours) {
    const wooId = Number(p.woo_id)
    const post = rawPosts.get(wooId)
    if (!post) continue
    const meta = rawMeta.get(wooId) || {}

    const updates = {}

    if (post.post_title && p.name !== post.post_title && post.post_title.trim().length > p.name.trim().length) {
      // hanya perbaiki kalau raw title LEBIH LENGKAP dari nama kita (indikasi terpotong),
      // bukan sekadar beda spasi/whitespace kosmetik dari raw yang justru lebih berantakan.
      updates.name = post.post_title.trim()
      updates.slug = slugify(post.post_title.trim()) + `-${wooId}`
    }

    if (meta._regular_price && p.regular_price === null) {
      updates.regular_price = meta._regular_price
      updates.sale_price = meta._sale_price || null
      if (meta._stock_status) {
        updates.stock_status = meta._stock_status === "instock" ? "INSTOCK" : meta._stock_status === "onbackorder" ? "ONBACKORDER" : "OUTOFSTOCK"
      }
    }

    const rawStatus = mapStatus(post.post_status)
    if (rawStatus && rawStatus !== p.status) {
      updates.status = rawStatus
    }

    if (Object.keys(updates).length === 0) continue

    const fields = Object.keys(updates)
    const setClause = fields.map(f => `${f} = ?`).join(", ")
    const values = fields.map(f => updates[f])

    if (DRY_RUN) {
      console.log(`[DRY-RUN] product id=${p.id} woo_id=${wooId}:`, updates)
    } else {
      try {
        await prisma.query(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, p.id])
      } catch (e) {
        errors.push({ id: p.id, wooId, error: e.message })
        continue
      }
    }

    if (updates.name) nameFixed++
    if (updates.regular_price !== undefined) priceFixed++
    if (updates.status) statusFixed++
  }

  console.log(`\nNama diperbaiki: ${nameFixed}`)
  console.log(`Harga diperbaiki: ${priceFixed}`)
  console.log(`Status diperbaiki: ${statusFixed}`)
  if (errors.length > 0) {
    console.log(`\nGagal (${errors.length}):`)
    for (const e of errors) console.log(`  id=${e.id} woo_id=${e.wooId}: ${e.error}`)
  }

  await raw.end()
  await prisma.end()
}
main().catch(e => { console.error(e); process.exit(1) })
