// Proses hasil review manual docs/product-tags-brand-candidates-review.csv
// (kolom final_action: TAG | BRAND | DISCARD, ditambahkan manual di Excel/Sheets).
//
// - TAG     -> insert ke tabel product_tags (kalau belum ada)
// - BRAND   -> upsert ke tabel brands, lalu set products.brand_id
//              (kalau produk SUDAH punya brand lain, TIDAK ditimpa - dicatat
//              sebagai konflik untuk direview manual, supaya tidak diam-diam
//              menimpa data yang mungkin sudah benar)
// - DISCARD -> dilewati, tidak ada aksi
//
// Pemakaian: npx tsx scripts/process-reviewed-tags.ts
import fs from "fs"
import { parse } from "csv-parse/sync"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPrisma } = require("../src/lib/prisma/client")
const prisma = getPrisma()

const REVIEW_FILE = "docs/product-tags-brand-candidates-review.csv"

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

async function main() {
  const content = fs.readFileSync(REVIEW_FILE, "utf-8")
  const rows = parse(content, { columns: true, skip_empty_lines: true }) as {
    product_woo_id: string
    product_name: string
    tag_id: string
    tag_name: string
    final_action?: string
  }[]

  const unreviewed = rows.filter((r) => !r.final_action?.trim())
  if (unreviewed.length > 0) {
    console.log(`${unreviewed.length} baris belum diisi final_action - dilewati (bukan error).`)
  }

  type ProductRef = { id: number; wooId: number; brandId: number | null; name: string }
  const products = (await prisma.product.findMany({
    select: { id: true, wooId: true, brandId: true, name: true },
  })) as ProductRef[]
  const wooIdToProduct = new Map<number, ProductRef>(products.map((p) => [p.wooId, p]))

  let tagCount = 0
  let brandSetCount = 0
  const brandConflicts: { product_woo_id: string; product_name: string; existing_brand_id: number; wanted_brand: string }[] = []
  const brandSlugCache = new Map<string, number>()

  for (const r of rows) {
    const action = r.final_action?.trim().toUpperCase()
    if (!action || action === "DISCARD") continue

    const product = wooIdToProduct.get(Number(r.product_woo_id))
    if (!product) {
      console.log(`  woo_id ${r.product_woo_id} tidak ditemukan di products, dilewati.`)
      continue
    }

    if (action === "TAG") {
      const tagId = Number(r.tag_id)
      const exists = await prisma.productTag.findUnique({
        where: { productId_tagId: { productId: product.id, tagId } },
      })
      if (!exists) {
        await prisma.productTag.create({ data: { productId: product.id, tagId } })
        tagCount += 1
      }
      continue
    }

    if (action === "BRAND") {
      if (product.brandId) {
        brandConflicts.push({
          product_woo_id: r.product_woo_id,
          product_name: r.product_name,
          existing_brand_id: product.brandId,
          wanted_brand: r.tag_name,
        })
        continue
      }

      const slug = slugifyName(r.tag_name)
      let brandId = brandSlugCache.get(slug)
      if (!brandId) {
        const brand = await prisma.brand.upsert({
          where: { slug },
          create: { name: r.tag_name, slug },
          update: {},
        })
        brandId = brand.id as number
        brandSlugCache.set(slug, brandId)
      }

      await prisma.product.update({ where: { id: product.id }, data: { brandId } })
      product.brandId = brandId // biar konsisten kalau woo_id yang sama muncul >1 baris
      brandSetCount += 1
      continue
    }

    console.log(`  final_action "${r.final_action}" tidak dikenali (baris woo_id ${r.product_woo_id}), dilewati.`)
  }

  console.log(`\nTag ditambahkan: ${tagCount}`)
  console.log(`Brand di-set: ${brandSetCount}`)
  if (brandConflicts.length > 0) {
    console.log(`\n${brandConflicts.length} produk SUDAH punya brand lain, TIDAK ditimpa (perlu review manual):`)
    fs.writeFileSync(
      "docs/product-brand-conflicts-review.csv",
      "product_woo_id,product_name,existing_brand_id,wanted_brand\n" +
        brandConflicts.map((c) => `${c.product_woo_id},"${c.product_name.replace(/"/g, '""')}",${c.existing_brand_id},${c.wanted_brand}`).join("\n") +
        "\n",
      "utf-8"
    )
    console.log("Ditulis ke docs/product-brand-conflicts-review.csv")
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
