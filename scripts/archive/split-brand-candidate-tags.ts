// Keluarkan baris product_tags yang is_brand_candidate=true (tebakan brand dari
// judul produk, BELUM diverifikasi manual - lihat memory project soal auto-tagging
// brand, ada minimal 1 tebakan salah yang sudah ketemu) dari tabel product_tags.
// Ditulis ke docs/ (gitignored) untuk direview manual, bukan dihapus permanen.
import fs from "fs"
import { parse } from "csv-parse/sync"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPrisma } = require("../src/lib/prisma/client")
const prisma = getPrisma()

// Dijalankan sekali (2026-07-25). Path folder CSV sumber diberikan lewat
// argumen CLI, bukan hardcode -> script aman di-commit tanpa membocorkan
// path lokal siapapun.
// Pemakaian: npx tsx scripts/archive/split-brand-candidate-tags.ts "<path folder csv>"
const CSV_DIR = process.argv[2]
if (!CSV_DIR) {
  console.error("Usage: npx tsx scripts/archive/split-brand-candidate-tags.ts <path folder csv>")
  process.exit(1)
}

function readCsv(filename: string) {
  const content = fs.readFileSync(`${CSV_DIR}/${filename}`, "utf-8")
  return parse(content, { columns: true, skip_empty_lines: true })
}

async function main() {
  const csvRows = readCsv("product_tags.csv") as {
    product_woo_id: string
    tag_id: string
    is_brand_candidate: string
  }[]
  const candidates = csvRows.filter((r) => r.is_brand_candidate === "true")
  console.log(`Baris is_brand_candidate=true di CSV: ${candidates.length}`)

  const products = await prisma.product.findMany({ select: { id: true, wooId: true, name: true } })
  const wooIdToProduct = new Map(products.map((p: { id: number; wooId: number; name: string }) => [p.wooId, p]))

  const tags = await prisma.tag.findMany({ select: { id: true, name: true } })
  const tagById = new Map(tags.map((t: { id: number; name: string }) => [t.id, t.name]))

  const reviewRows: { product_woo_id: number; product_name: string; tag_id: number; tag_name: string }[] = []
  const deletePairs: { productId: number; tagId: number }[] = []
  let unmapped = 0

  for (const r of candidates) {
    const wooId = Number(r.product_woo_id)
    const tagId = Number(r.tag_id)
    const product = wooIdToProduct.get(wooId)
    if (!product) {
      unmapped += 1
      continue
    }
    reviewRows.push({
      product_woo_id: wooId,
      product_name: product.name,
      tag_id: tagId,
      tag_name: (tagById.get(tagId) as string) ?? "?",
    })
    deletePairs.push({ productId: product.id, tagId })
  }

  if (unmapped > 0) console.log(`${unmapped} baris woo_id-nya tidak ketemu di products, dilewati.`)

  // Tulis CSV review dulu SEBELUM delete, supaya kalau delete gagal di tengah, data tidak hilang percuma.
  // (idempotent: aman ditulis ulang kalau script ini di-rerun)
  const header = "product_woo_id,product_name,tag_id,tag_name\n"
  const body = reviewRows
    .map((r) => `${r.product_woo_id},"${r.product_name.replace(/"/g, '""')}",${r.tag_id},${r.tag_name}`)
    .join("\n")
  fs.writeFileSync("docs/product-tags-brand-candidates-review.csv", header + body + "\n", "utf-8")
  console.log(`Ditulis ${reviewRows.length} baris ke docs/product-tags-brand-candidates-review.csv`)

  // Batch delete (bukan 1 koneksi per baris) - jauh lebih tahan terhadap connection
  // pool timeout di shared hosting. deleteMany dgn OR pair yang sudah tidak ada = no-op,
  // jadi aman kalau script ini di-rerun setelah gagal di tengah jalan.
  let deleted = 0
  const BATCH = 50
  for (let i = 0; i < deletePairs.length; i += BATCH) {
    const batch = deletePairs.slice(i, i + BATCH)
    const res = await prisma.productTag.deleteMany({
      where: { OR: batch.map((p) => ({ productId: p.productId, tagId: p.tagId })) },
    })
    deleted += res.count
    console.log(`  batch ${i / BATCH + 1}: dihapus ${res.count}`)
  }
  console.log(`Total dihapus dari tabel product_tags: ${deleted}`)

  console.log("product_tags tersisa:", await prisma.productTag.count())
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
