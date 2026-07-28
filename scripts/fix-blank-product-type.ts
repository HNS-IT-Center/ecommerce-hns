/**
 * Task #10 — perbaiki produk yang kolom `type`-nya kosong.
 *
 * `ProductType` adalah enum wajib, tapi 35 baris hasil import lama menyimpan
 * string kosong di sana. Prisma menolak membaca baris seperti itu begitu kolom
 * `type` ikut terambil: "Value '' not found in enum 'ProductType'" (P2023).
 * Karena `getProducts()` memakai `include` tanpa `select`, seluruh kolom skalar
 * ikut terbaca — jadi query apa pun yang menyentuh salah satu baris ini akan
 * gagal, bukan sekadar mengembalikan data aneh.
 *
 * Gejalanya belum pernah muncul di storefront karena `buildPrismaWhere` selalu
 * menyaring `status: 'PUBLISHED'`, sedangkan ke-35 baris itu DRAFT atau
 * PRIVATE. Begitu salah satunya dipublikasikan, halaman yang memuatnya akan
 * 500. Itu sebabnya ini diperbaiki sekarang, bukan setelah kejadian.
 *
 * Semuanya PC rakitan HNS sendiri (HNS PC BUNDLE / READY / GAMING /
 * WORKSTATION). Tidak ada yang punya induk maupun varian, jadi SIMPLE adalah
 * satu-satunya tipe yang cocok — bukan tebakan, tapi kesimpulan dari struktur
 * datanya. Script tetap menghitung ulang tipe per baris dan berhenti kalau ada
 * yang ternyata punya induk atau varian.
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

const VALID = ["SIMPLE", "VARIABLE", "VARIATION", "GROUPED", "EXTERNAL"]

type Row = {
  id: number
  woo_id: number
  name: string
  type: string
  parent_id: number | null
  status: string
  n_variations: bigint
}

async function main() {
  console.log(APPLY ? "*** MODE: APPLY ***" : "--- MODE: DRY RUN ---")

  // SQL mentah: Prisma tidak bisa membaca baris ini lewat API biasa.
  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT p.id, p.woo_id, p.name, p.type, p.parent_id, p.status,
           (SELECT COUNT(*) FROM products v WHERE v.parent_id = p.id) n_variations
    FROM products p
    WHERE p.type NOT IN (${VALID.map((v) => `'${v}'`).join(",")})
    ORDER BY p.woo_id
  `)

  console.log(`\nbaris dengan type tidak valid: ${rows.length}`)
  if (rows.length === 0) {
    console.log("tidak ada yang perlu diperbaiki.")
    await prisma.$disconnect()
    return
  }

  const planned = rows.map((r) => ({
    ...r,
    target: r.parent_id !== null ? "VARIATION" : Number(r.n_variations) > 0 ? "VARIABLE" : "SIMPLE",
  }))

  const spread = new Map<string, number>()
  for (const p of planned) spread.set(p.target, (spread.get(p.target) ?? 0) + 1)
  console.log("rencana:", [...spread.entries()].map(([k, v]) => `${k}=${v}`).join(", "))

  const statusSpread = new Map<string, number>()
  for (const p of planned) statusSpread.set(p.status, (statusSpread.get(p.status) ?? 0) + 1)
  console.log("status :", [...statusSpread.entries()].map(([k, v]) => `${k}=${v}`).join(", "))

  console.log("\ncontoh:")
  for (const p of planned.slice(0, 5)) {
    console.log(`   woo#${p.woo_id} -> ${p.target}  ${p.name.slice(0, 50)}`)
  }

  // Kalau ada yang bukan SIMPLE, strukturnya lebih rumit dari yang ditinjau —
  // berhenti dan minta orang melihatnya dulu.
  const nonSimple = planned.filter((p) => p.target !== "SIMPLE")
  if (nonSimple.length > 0) {
    console.log("\n!! baris berikut BUKAN SIMPLE:")
    for (const p of nonSimple) {
      console.log(`   woo#${p.woo_id} -> ${p.target} (induk=${p.parent_id}, varian=${Number(p.n_variations)})`)
    }
    console.error("\nDIBATALKAN: hanya kasus SIMPLE yang sudah ditinjau. Periksa baris di atas dulu.")
    await prisma.$disconnect()
    process.exit(1)
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-product-type-${stamp}.json`)
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        rows: planned.map((p) => ({ id: p.id, wooId: p.woo_id, oldType: p.type, newType: p.target })),
      },
      null,
      2
    )
  )
  console.log(`\nbackup ditulis: ${backupPath}`)

  const ids = planned.map((p) => p.id)
  const affected = await prisma.$executeRawUnsafe(
    `UPDATE products SET type = 'SIMPLE' WHERE id IN (${ids.join(",")}) AND type NOT IN (${VALID.map((v) => `'${v}'`).join(",")})`
  )

  console.log(`\nSELESAI. baris diperbarui: ${affected}`)
  console.log(`Rollback: ${backupPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
