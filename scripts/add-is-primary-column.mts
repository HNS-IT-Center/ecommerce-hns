/**
 * Tambah kolom `is_primary` pada `product_categories`.
 *
 * Dijalankan manual, BUKAN lewat `prisma migrate`: database ini tidak punya
 * tabel `_prisma_migrations` sama sekali, jadi `migrate dev` akan memperlakukan
 * seluruh skema sebagai migrasi pertama dan berpotensi mereset data produksi.
 * `db push` juga berisiko karena akan ikut merekonsiliasi selisih lain yang
 * mungkin ada antara schema.prisma dan database.
 *
 * Perubahannya aditif: kolom baru, NOT NULL, default 0. Tidak ada baris yang
 * berubah artinya — semua kaitan yang sudah ada tetap bukan kategori utama
 * sampai ada yang menetapkannya. Penetapan itu pekerjaan backlog migrasi.
 *
 * Default DRY RUN. Tambahkan --apply untuk benar-benar menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { writeFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const { getPrisma } = await import("../src/lib/prisma/client")
const p = getPrisma()

const cols = await p.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM product_categories")
const sudahAda = cols.some((c) => c.Field === "is_primary")

console.log("Kolom sekarang:", cols.map((c) => c.Field).join(", "))
console.log("is_primary sudah ada?", sudahAda ? "YA" : "TIDAK")

const jumlahSebelum = await p.productCategory.count()
console.log("Baris product_categories:", jumlahSebelum)

if (sudahAda) {
  console.log("\nTidak ada yang perlu dikerjakan.")
} else if (!APPLY) {
  console.log("\n[DRY RUN] Akan dijalankan:")
  console.log("  ALTER TABLE product_categories")
  console.log("  ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0;")
  console.log("\nJalankan ulang dengan --apply untuk menerapkan.")
} else {
  // Cadangan kaitan sebelum menyentuh struktur tabel — konvensi project:
  // selalu backup sebelum transform, walau perubahannya aditif.
  const rows = await p.productCategory.findMany()
  const file = `scripts/backup-product-categories-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  writeFileSync(file, JSON.stringify(rows, null, 2))
  console.log(`\nCadangan ${rows.length} baris ditulis ke ${file}`)

  await p.$executeRawUnsafe(
    "ALTER TABLE product_categories ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0"
  )
  console.log("Kolom ditambahkan.")

  const sesudah = await p.$queryRawUnsafe<Array<{ Field: string }>>("SHOW COLUMNS FROM product_categories")
  console.log("Kolom sekarang:", sesudah.map((c) => c.Field).join(", "))
  console.log("Baris sesudah:", await p.productCategory.count(), "(harus sama dengan sebelum)")

  const primaryCount = await p.$queryRawUnsafe<Array<{ n: bigint }>>(
    "SELECT COUNT(*) AS n FROM product_categories WHERE is_primary = 1"
  )
  console.log("Baris dengan is_primary=1:", Number(primaryCount[0].n), "(harus 0 — pengisian menyusul di backlog migrasi)")
}

await p.$disconnect()
