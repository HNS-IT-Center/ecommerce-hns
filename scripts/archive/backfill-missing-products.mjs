// Backfill 177 produk yang hilang dari Prisma DB tapi ASLI ada di WooCommerce
// (52/54 di antaranya sempat kena import_quarantine gara-gara "kolom bergeser"
// di CSV lama, lalu tidak pernah diproses ulang - lihat diskusi 2026-07-25).
// Ambil LANGSUNG dari tabel WordPress mentah (wp_posts/wp_postmeta/term_*)
// yang sudah diimpor ke database u859138789_raw_dump, BUKAN dari CSV lama.
import mariadb from "mariadb"
import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

if (!process.env.RAW_DUMP_DATABASE_URL) {
  console.error("RAW_DUMP_DATABASE_URL belum diisi di .env.local")
  process.exit(1)
}
const rawUrl = new URL(process.env.RAW_DUMP_DATABASE_URL.replace(/^['"]|['"]$/g, ""))
const RAW_DB = {
  host: rawUrl.hostname, port: Number(rawUrl.port) || 3306,
  user: decodeURIComponent(rawUrl.username), password: decodeURIComponent(rawUrl.password),
  database: rawUrl.pathname.slice(1), connectTimeout: 20000,
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
}

const DRY_RUN = process.argv.includes("--dry-run")
let fakeIdCounter = -1

async function main() {
  const raw = await mariadb.createConnection(RAW_DB)

  const prismaUrl = process.env.DATABASE_URL.replace(/^['"]|['"]$/g, "")
  const pu = new URL(prismaUrl)
  const prisma = await mariadb.createConnection({
    host: pu.hostname, port: Number(pu.port) || 3306,
    user: decodeURIComponent(pu.username), password: decodeURIComponent(pu.password),
    database: pu.pathname.slice(1), connectTimeout: 15000,
  })

  async function write(sql, params, label) {
    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${label}:`, params)
      return { insertId: fakeIdCounter-- }
    }
    return prisma.query(sql, params)
  }

  // 1. Tentukan target ID (produk+variasi ASLI di WooCommerce tapi belum ada di Prisma, exclude trash)
  const lookupIds = await raw.query("SELECT product_id FROM wp_wc_product_meta_lookup")
  const lookupIdSet = new Set(lookupIds.map(r => Number(r.product_id)))
  const ourIds = await prisma.query("SELECT woo_id FROM products")
  const ourIdSet = new Set(ourIds.map(r => Number(r.woo_id)))
  const candidateIds = [...lookupIdSet].filter(id => !ourIdSet.has(id))

  if (candidateIds.length === 0) {
    console.log("Tidak ada produk WooCommerce yang hilang dari Prisma DB - tidak ada yang perlu di-backfill.")
    await raw.end()
    await prisma.end()
    return
  }

  const placeholders = candidateIds.map(() => "?").join(",")
  const postsRaw = await raw.query(
    `SELECT ID, post_title, post_content, post_excerpt, post_status, post_type, post_parent, post_name
     FROM wp_posts WHERE ID IN (${placeholders}) AND post_status != 'trash'`,
    candidateIds
  )
  // Driver mengembalikan kolom BIGINT (ID, post_parent) sebagai BigInt - normalisasi ke
  // Number supaya konsisten dipakai sebagai Map key di seluruh script (BigInt 13n !== Number 13
  // sebagai Map key, walau nilainya "sama").
  const posts = postsRaw.map(p => ({ ...p, ID: Number(p.ID), post_parent: Number(p.post_parent) }))
  console.log(`Target produk untuk backfill: ${posts.length}`)

  if (posts.length === 0) {
    console.log("Tidak ada produk (non-trash) yang perlu di-backfill.")
    await raw.end()
    await prisma.end()
    return
  }

  const targetIds = posts.map(p => p.ID)
  const idPlaceholders = targetIds.map(() => "?").join(",")

  // 2. Ambil semua postmeta relevan sekaligus
  const RELEVANT_KEYS = [
    "_sku", "_regular_price", "_sale_price", "_stock", "_stock_status",
    "_manage_stock", "_backorders", "_sold_individually", "_thumbnail_id",
    "_product_image_gallery", "_product_version",
  ]
  const metaRows = await raw.query(
    `SELECT post_id, meta_key, meta_value FROM wp_postmeta
     WHERE post_id IN (${idPlaceholders}) AND meta_key IN (${RELEVANT_KEYS.map(() => "?").join(",")})`,
    [...targetIds, ...RELEVANT_KEYS]
  )
  const metaByPost = new Map()
  for (const r of metaRows) {
    const postId = Number(r.post_id)
    if (!metaByPost.has(postId)) metaByPost.set(postId, {})
    metaByPost.get(postId)[r.meta_key] = r.meta_value
  }

  // variation-specific attribute value meta (attribute_pa_xxx / attribute_nama-custom)
  const attrMetaRows = await raw.query(
    `SELECT post_id, meta_key, meta_value FROM wp_postmeta
     WHERE post_id IN (${idPlaceholders}) AND meta_key LIKE 'attribute_%'`,
    targetIds
  )
  const variationAttrsByPost = new Map()
  for (const r of attrMetaRows) {
    const postId = Number(r.post_id)
    if (!variationAttrsByPost.has(postId)) variationAttrsByPost.set(postId, [])
    variationAttrsByPost.get(postId).push({ key: r.meta_key.replace(/^attribute_/, ""), value: r.meta_value })
  }

  // 3. Ambil semua term_relationships utk target ID (product_type, product_cat, product_tag, product_brand, pa_*)
  const termRels = await raw.query(
    `SELECT tr.object_id, tt.taxonomy, t.name, t.slug
     FROM wp_term_relationships tr
     JOIN wp_term_taxonomy tt ON tt.term_taxonomy_id = tr.term_taxonomy_id
     JOIN wp_terms t ON t.term_id = tt.term_id
     WHERE tr.object_id IN (${idPlaceholders})`,
    targetIds
  )
  const termsByPost = new Map()
  for (const r of termRels) {
    const objectId = Number(r.object_id)
    if (!termsByPost.has(objectId)) termsByPost.set(objectId, [])
    termsByPost.get(objectId).push(r)
  }

  // 4. Mapping taxonomy pa_xxx -> label atribut asli (dari WooCommerce attribute taxonomy registry)
  const attrTax = await raw.query("SELECT attribute_name, attribute_label FROM wp_woocommerce_attribute_taxonomies")
  const paSlugToLabel = new Map(attrTax.map(r => [`pa_${r.attribute_name}`, r.attribute_label]))

  // 5. Ambil URL attachment (thumbnail + gallery) - guid di wp_posts utk post_type=attachment
  const allImageIds = new Set()
  for (const m of metaByPost.values()) {
    if (m._thumbnail_id) allImageIds.add(Number(m._thumbnail_id))
    if (m._product_image_gallery) {
      for (const id of m._product_image_gallery.split(",")) {
        const n = Number(id.trim())
        if (n) allImageIds.add(n)
      }
    }
  }
  let imageUrlById = new Map()
  if (allImageIds.size > 0) {
    const imgPlaceholders = [...allImageIds].map(() => "?").join(",")
    const attachments = await raw.query(`SELECT ID, guid FROM wp_posts WHERE ID IN (${imgPlaceholders})`, [...allImageIds])
    imageUrlById = new Map(attachments.map(a => [Number(a.ID), a.guid]))
  }

  // 6. Ambil master data Prisma yang sudah ada (utk matching, bukan bikin duplikat)
  const existingCategories = await prisma.query("SELECT id, name FROM categories")
  const catByName = new Map(existingCategories.map(c => [c.name.toLowerCase().trim(), c.id]))
  const existingTags = await prisma.query("SELECT id, name FROM tags")
  const tagByName = new Map(existingTags.map(t => [t.name.toLowerCase().trim(), t.id]))
  const existingBrands = await prisma.query("SELECT id, name FROM brands")
  const brandByName = new Map(existingBrands.map(b => [b.name.toLowerCase().trim(), b.id]))
  const existingAttrs = await prisma.query("SELECT id, name FROM attributes")
  const attrByName = new Map(existingAttrs.map(a => [a.name.toLowerCase().trim(), a.id]))
  const existingAttrValues = await prisma.query("SELECT id, attribute_id, value FROM attribute_values")
  const attrValueByKey = new Map(existingAttrValues.map(v => [`${v.attribute_id}::${v.value.toLowerCase().trim()}`, v.id]))
  const productsAll = await prisma.query("SELECT id, woo_id, name FROM products")
  const wooIdToProductId = new Map(productsAll.map(p => [p.woo_id, p.id]))
  const wooIdToName = new Map(productsAll.map(p => [p.woo_id, p.name]))

  // ==========================================================================
  // Insert produk (non-variation dulu, supaya parentId variasi bisa di-resolve)
  // ==========================================================================
  const nonVariations = posts.filter(p => p.post_type === "product")
  const variations = posts.filter(p => p.post_type === "product_variation")
  // urutkan: non-variation dulu
  const orderedPosts = [...nonVariations, ...variations]

  let created = 0
  const skipped = []
  const report = { categories: 0, tags: 0, brands: 0, attributes: 0, images: 0 }

  for (const post of orderedPosts) {
    try {
      const meta = metaByPost.get(post.ID) || {}
      const terms = termsByPost.get(post.ID) || []

      const isVariation = post.post_type === "product_variation"
      let type = "SIMPLE"
      if (isVariation) {
        type = "VARIATION"
      } else {
        const typeTerm = terms.find(t => t.taxonomy === "product_type")
        if (typeTerm) type = typeTerm.name.toUpperCase()
      }

      let parentId = null
      if (isVariation) {
        parentId = wooIdToProductId.get(post.post_parent)
        if (!parentId) {
          skipped.push({ id: post.ID, reason: `parent woo_id ${post.post_parent} belum ada di Prisma DB` })
          continue
        }
      }

      const status =
        post.post_status === "publish" ? "PUBLISHED" :
        post.post_status === "private" ? "PRIVATE" : "DRAFT"

      const name = isVariation
        ? (wooIdToName.get(post.post_parent) || nonVariations.find(p => p.ID === post.post_parent)?.post_title || post.post_title || `Variation ${post.ID}`)
        : post.post_title
      const slug = slugify(name || `product-${post.ID}`) + `-${post.ID}`

      const regularPrice = meta._regular_price || null
      const salePrice = meta._sale_price || null
      const stockQty = meta._stock !== undefined && meta._stock !== null ? parseInt(meta._stock, 10) : null
      const stockStatus =
        meta._stock_status === "instock" ? "INSTOCK" :
        meta._stock_status === "onbackorder" ? "ONBACKORDER" : "OUTOFSTOCK"
      const backordersAllowed = meta._backorders ? meta._backorders !== "no" : null
      const soldIndividually = meta._sold_individually ? meta._sold_individually === "yes" : null
      const sku = meta._sku || null

      const insertResult = await write(
        `INSERT INTO products
          (woo_id, type, status, sku, name, slug, short_description, description,
           regular_price, sale_price, stock_status, stock_qty, backorders_allowed,
           sold_individually, visibility, parent_id, imported_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VISIBLE', ?, NOW(), NOW())`,
        [
          post.ID, type, status, sku, name || `(tanpa nama ${post.ID})`, slug,
          post.post_excerpt || null, post.post_content || null,
          regularPrice, salePrice, stockStatus, stockQty, backordersAllowed,
          soldIndividually, parentId,
        ],
        `product woo_id=${post.ID} "${name}"`
      )
      const productId = Number(insertResult.insertId)
      wooIdToProductId.set(post.ID, productId)
      wooIdToName.set(post.ID, name)
      created += 1

      // --- Kategori/Tag/Brand via term_relationships ---
      for (const t of terms) {
        if (t.taxonomy === "product_cat") {
          const catId = catByName.get(t.name.toLowerCase().trim())
          if (catId) {
            await write(
              "INSERT IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)",
              [productId, catId],
              `category ${t.name}`
            )
            report.categories += 1
          }
        } else if (t.taxonomy === "product_tag") {
          const tagId = tagByName.get(t.name.toLowerCase().trim())
          if (tagId) {
            await write("INSERT IGNORE INTO product_tags (product_id, tag_id) VALUES (?, ?)", [productId, tagId], `tag ${t.name}`)
            report.tags += 1
          }
        } else if (t.taxonomy === "product_brand") {
          const brandId = brandByName.get(t.name.toLowerCase().trim())
          if (brandId) {
            await write("UPDATE products SET brand_id = ? WHERE id = ?", [brandId, productId], `brand ${t.name}`)
            report.brands += 1
          }
        } else if (t.taxonomy.startsWith("pa_") && !isVariation) {
          const attrLabel = paSlugToLabel.get(t.taxonomy) || t.taxonomy.replace(/^pa_/, "")
          const attrId = attrByName.get(attrLabel.toLowerCase().trim())
          if (attrId) {
            const valueKey = `${attrId}::${t.name.toLowerCase().trim()}`
            let valueId = attrValueByKey.get(valueKey)
            if (!valueId) {
              const insVal = await write(
                "INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)",
                [attrId, t.name],
                `attribute_value ${attrLabel}=${t.name}`
              )
              valueId = Number(insVal.insertId)
              attrValueByKey.set(valueKey, valueId)
            }
            await write(
              "INSERT IGNORE INTO product_attributes (product_id, attribute_id, value_id, position) VALUES (?, ?, ?, 0)",
              [productId, attrId, valueId],
              `product_attribute ${attrLabel}=${t.name}`
            )
            report.attributes += 1
          }
        }
      }

      // --- Atribut spesifik varian (attribute_pa_xxx di postmeta) ---
      if (isVariation) {
        const varAttrs = variationAttrsByPost.get(post.ID) || []
        for (const va of varAttrs) {
          const taxSlug = va.key.startsWith("pa_") ? va.key : null
          if (!taxSlug || !va.value) continue
          const attrLabel = paSlugToLabel.get(taxSlug) || taxSlug.replace(/^pa_/, "")
          const attrId = attrByName.get(attrLabel.toLowerCase().trim())
          if (!attrId) continue
          const valueKey = `${attrId}::${va.value.toLowerCase().trim()}`
          let valueId = attrValueByKey.get(valueKey)
          if (!valueId) {
            const insVal = await write("INSERT INTO attribute_values (attribute_id, value) VALUES (?, ?)", [attrId, va.value], `attribute_value (var) ${attrLabel}=${va.value}`)
            valueId = Number(insVal.insertId)
            attrValueByKey.set(valueKey, valueId)
          }
          await write(
            "INSERT IGNORE INTO product_attributes (product_id, attribute_id, value_id, position) VALUES (?, ?, ?, 0)",
            [productId, attrId, valueId],
            `product_attribute (var) ${attrLabel}=${va.value}`
          )
          report.attributes += 1
        }
      }

      // --- Gambar ---
      const imgIds = []
      if (meta._thumbnail_id) imgIds.push(Number(meta._thumbnail_id))
      if (meta._product_image_gallery) {
        for (const id of meta._product_image_gallery.split(",")) {
          const n = Number(id.trim())
          if (n && !imgIds.includes(n)) imgIds.push(n)
        }
      }
      let pos = 0
      for (const imgId of imgIds) {
        const url = imageUrlById.get(imgId)
        if (!url) continue
        await write(
          "INSERT INTO product_images (product_id, url, position, is_primary) VALUES (?, ?, ?, ?)",
          [productId, url, pos, pos === 0],
          `image ${url}`
        )
        report.images += 1
        pos += 1
      }
    } catch (e) {
      skipped.push({ id: post.ID, reason: e.message })
    }
  }

  console.log(`\nBerhasil dibuat: ${created} produk`)
  console.log("Report relasi:", report)
  console.log(`\nDilewati (${skipped.length}):`)
  for (const s of skipped) console.log(`  ${s.id}: ${s.reason}`)

  await raw.end()
  await prisma.end()
}

main().catch(e => { console.error(e); process.exit(1) })
