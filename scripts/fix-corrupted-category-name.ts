/**
 * Task #12 — perbaiki nama kategori yang rusak sejak import.
 *
 * Kategori id=35 tersimpan sebagai "SSD SATA 2\" — karakter terakhirnya
 * backslash asli (codepoint 92), bukan artefak tampilan konsol. Nama itu
 * muncul apa adanya di halaman kategori dan di pemilih kategori admin.
 * Isinya seluruhnya SSD SATA 2,5 inci standar (Samsung 870 EVO, Lexar NS100,
 * TForce Vulcan Z), dan slug-nya sudah "…-ssd-sata-2", jadi maksud aslinya
 * hampir pasti 2.5" dengan tanda inci yang hancur saat CSV dibaca.
 *
 * Slug TIDAK disentuh, sehingga URL kategori tetap hidup — sama seperti rename
 * chipset di task #3.
 *
 * Penyisiran seluruh tabel memastikan ini satu-satunya: 115 kategori, 135
 * brand, dan 29 tag diperiksa untuk backslash nyasar, mojibake, entitas HTML,
 * dan karakter kendali — hanya baris ini yang kena.
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

/** Nama lama (persis, termasuk backslash) -> nama baru. */
const RENAMES = new Map<string, string>([["SSD SATA 2\\", 'SSD SATA 2.5"']])

async function main() {
  console.log(APPLY ? "*** MODE: APPLY ***" : "--- MODE: DRY RUN ---")

  const cats = await prisma.category.findMany({
    select: { id: true, name: true, path: true, slug: true, parentId: true },
  })

  const targets = cats
    .filter((c) => RENAMES.has(c.name))
    .map((c) => {
      const newName = RENAMES.get(c.name)!
      const cut = c.path.lastIndexOf(" > ")
      return {
        cat: c,
        newName,
        newPath: cut === -1 ? newName : `${c.path.slice(0, cut)} > ${newName}`,
        children: cats.filter((x) => x.parentId === c.id).length,
      }
    })

  console.log(`\nkategori cocok: ${targets.length} dari ${RENAMES.size} pola`)
  for (const t of targets) {
    console.log(`  ${JSON.stringify(t.cat.name)} -> ${JSON.stringify(t.newName)}`)
    console.log(`     path : ${t.newPath}`)
    console.log(`     slug : ${t.cat.slug} (tidak diubah)`)
    console.log(`     anak : ${t.children}`)
  }

  const missed = [...RENAMES.keys()].filter((n) => !cats.some((c) => c.name === n))
  for (const m of missed) console.log(`  !! tidak ditemukan: ${JSON.stringify(m)}`)

  // Kalau punya anak, path anak ikut harus diperbarui — di luar cakupan ini.
  const withKids = targets.filter((t) => t.children > 0)
  if (withKids.length > 0) {
    console.error("\nDIBATALKAN: kategori punya anak, path turunannya ikut harus diperbarui.")
    await prisma.$disconnect()
    process.exit(1)
  }

  if (targets.length === 0) {
    console.log("\ntidak ada yang perlu diperbaiki.")
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-category-name-${stamp}.json`)
  writeFileSync(
    backupPath,
    JSON.stringify(
      { createdAt: new Date().toISOString(), before: targets.map((t) => t.cat) },
      null,
      2
    )
  )
  console.log(`\nbackup ditulis: ${backupPath}`)

  for (const t of targets) {
    await prisma.category.update({
      where: { id: t.cat.id },
      data: { name: t.newName, path: t.newPath },
    })
  }

  console.log(`\nSELESAI. kategori diperbarui: ${targets.length}`)
  console.log(`Rollback: ${backupPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
