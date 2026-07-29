/**
 * Cadangan penuh taksonomi sebelum migrasi.
 *
 * Menyimpan seluruh kategori (termasuk path, depth, slug, parentId) DAN seluruh
 * kaitan produk-kategori (termasuk penanda is_primary). Dua-duanya diperlukan:
 * kategori saja tidak cukup untuk memulihkan keadaan, karena merge menghapus
 * kategori beserta kaitannya lewat cascade.
 *
 * READ-ONLY terhadap database — hanya membaca lalu menulis file.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { writeFileSync } from "node:fs"

const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()

const stamp = new Date().toISOString().replace(/[:.]/g, "-")

const categories = await p.category.findMany({ orderBy: { id: "asc" } })
const links = await p.productCategory.findMany({ orderBy: [{ productId: "asc" }, { categoryId: "asc" }] })

const payload = {
  takenAt: new Date().toISOString(),
  counts: { categories: categories.length, links: links.length },
  categories,
  links,
}

const file = `scripts/backup-taxonomy-${stamp}.json`
writeFileSync(file, JSON.stringify(payload, null, 2))

console.log(`Cadangan ditulis ke ${file}`)
console.log(`  kategori: ${categories.length}`)
console.log(`  kaitan produk-kategori: ${links.length}`)
console.log(`  kaitan bertanda primary: ${links.filter((l) => l.isPrimary).length}`)

await p.$disconnect()
