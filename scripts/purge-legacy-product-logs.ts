/**
 * Hapus baris `product_logs` berformat lama.
 *
 * Sebelum penulisan log disatukan di `lib/logs/product-log.ts`, jalur harga
 * cepat di daftar produk menulis `field_affected = 'price'` dengan nilai
 * berformat `"Regular: 100, Sale: 0"`, sementara jalur form produk menulis
 * `'regular_price'` dengan angka mentah. Halaman log sekarang hanya memahami
 * bentuk yang kedua, jadi baris lama akan tampil sebagai teks mentah di kolom
 * nilai dan tidak ikut tersaring dengan benar.
 *
 * Proyek masih dalam tahap pengembangan dan isi tabel ini belum jadi catatan
 * audit yang dipakai, jadi baris lama dibuang alih-alih ditulis ulang —
 * menulis ulang baris audit adalah kebiasaan yang tidak ingin dibawa ke
 * produksi.
 *
 * Default DRY RUN. Tambahkan --apply untuk benar-benar menghapus.
 *
 *   npx tsx scripts/purge-legacy-product-logs.ts
 *   npx tsx scripts/purge-legacy-product-logs.ts --apply
 */
import { config } from "dotenv"
config({ path: ".env.local" })

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

/**
 * Dua penanda format lama:
 *
 * - `field_affected = 'price'` — hanya pernah ditulis jalur harga cepat lama.
 * - nilai yang diawali `"Regular: "` — bentuk rakitan yang tidak lagi dipakai.
 *
 * Keduanya diperiksa terpisah karena satu baris bisa memenuhi salah satunya
 * saja kalau pernah ada penulisan setengah jalan.
 */
const LEGACY_WHERE = {
  OR: [
    { fieldAffected: "price" },
    { oldValue: { startsWith: "Regular: " } },
    { newValue: { startsWith: "Regular: " } },
  ],
}

async function main() {
  console.log(APPLY ? "*** MODE: APPLY ***" : "--- MODE: DRY RUN ---")

  const total = await prisma.productLog.count()
  const rows = await prisma.productLog.findMany({
    where: LEGACY_WHERE,
    orderBy: { id: "asc" },
  })

  console.log(`\ntotal baris product_logs : ${total}`)
  console.log(`baris berformat lama     : ${rows.length}`)

  if (rows.length === 0) {
    console.log("\ntidak ada yang perlu dihapus.")
    await prisma.$disconnect()
    return
  }

  console.log("\ncontoh baris yang akan dihapus (maks. 10):")
  for (const row of rows.slice(0, 10)) {
    console.log(
      `  #${row.id} [${row.createdAt.toISOString()}] ${row.action} / ${row.fieldAffected}` +
        ` — ${row.productName}\n      lama: ${row.oldValue}\n      baru: ${row.newValue}`
    )
  }

  if (!APPLY) {
    console.log(
      `\n${rows.length} baris AKAN dihapus. Jalankan ulang dengan --apply untuk mengeksekusi.`
    )
    await prisma.$disconnect()
    return
  }

  const result = await prisma.productLog.deleteMany({ where: LEGACY_WHERE })
  console.log(`\n${result.count} baris dihapus. Sisa: ${total - result.count}`)

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
