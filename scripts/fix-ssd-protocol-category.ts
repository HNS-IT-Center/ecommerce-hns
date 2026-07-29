/**
 * Task #13 — tempatkan SSD internal di kategori protokol yang sesuai namanya.
 *
 * Aturannya datang dari staff dan sederhana: nama produk sudah menyebut
 * protokolnya sendiri, jadi yang bertuliskan NVME masuk kategori NVMe dan yang
 * bertuliskan SATA masuk kategori SATA. Penyisiran seluruh SSD internal
 * membenarkan aturan itu tanpa celah — 57 produk sudah cocok dan tidak satu
 * pun namanya diam soal protokol, jadi tidak ada yang perlu ditebak.
 *
 * Dua produk berada di kategori yang salah, dan salahnya justru dua arah:
 * satu NVMe terdampar di SATA, satu SATA terdampar di NVMe.
 *
 * Kategori CASING SSD dan SSD EXTERNAL sengaja tidak ikut diperiksa. Enclosure
 * kerap menyebut kedua protokol sekaligus ("VENTION M.2 NVMe & SATA SSD
 * Enclosure") sehingga aturan ini tidak berlaku di sana, dan portable drive
 * adalah kelas barang yang berbeda, bukan varian protokol.
 *
 * Kaitan ke induk tidak disentuh: kedua kategori bersaudara di bawah
 * "SSD / NVME", jadi jalur leluhur produk tetap sama.
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

/** Dicari lewat path supaya rename kategori tidak diam-diam melumpuhkan script. */
const NVME_PATH = "KOMPONEN PC / NB > SSD / NVME > M.2 / NVME"
const SATA_PATH = 'KOMPONEN PC / NB > SSD / NVME > SSD SATA 2.5"'

const SAYS_NVME = /\bNVME\b|\bM\.?2\b/
const SAYS_SATA = /\bSATA\b/

async function main() {
  console.log(APPLY ? "*** MODE: APPLY ***" : "--- MODE: DRY RUN ---")

  const cats = await prisma.category.findMany({ select: { id: true, path: true } })
  const nvme = cats.find((c) => c.path === NVME_PATH)
  const sata = cats.find((c) => c.path === SATA_PATH)

  if (!nvme || !sata) {
    console.error("DIBATALKAN: kategori tidak ditemukan lewat path.")
    if (!nvme) console.error(`  hilang: ${NVME_PATH}`)
    if (!sata) console.error(`  hilang: ${SATA_PATH}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const links = await prisma.productCategory.findMany({
    where: { categoryId: { in: [nvme.id, sata.id] } },
    select: { categoryId: true, product: { select: { id: true, wooId: true, name: true } } },
  })

  const moves: { productId: number; wooId: number; name: string; from: number; to: number }[] = []
  let cocok = 0
  let bisu = 0

  for (const l of links) {
    const n = l.product.name.toUpperCase()
    const isNvme = SAYS_NVME.test(n)
    const isSata = SAYS_SATA.test(n)

    // Hanya bertindak kalau namanya menyebut tepat satu protokol.
    if (isNvme === isSata) {
      bisu += 1
      continue
    }

    const target = isNvme ? nvme.id : sata.id
    if (target === l.categoryId) {
      cocok += 1
      continue
    }

    moves.push({
      productId: l.product.id,
      wooId: l.product.wooId,
      name: l.product.name,
      from: l.categoryId,
      to: target,
    })
  }

  const label = (id: number) => (id === nvme.id ? "NVMe" : "SATA")

  console.log(`\nSSD internal diperiksa : ${links.length}`)
  console.log(`  sudah cocok          : ${cocok}`)
  console.log(`  nama tidak menyebut  : ${bisu}`)
  console.log(`  PERLU DIPINDAH       : ${moves.length}`)
  for (const m of moves) {
    console.log(`     woo#${m.wooId}  ${label(m.from)} -> ${label(m.to)}`)
    console.log(`        ${m.name.slice(0, 62)}`)
  }

  if (moves.length === 0) {
    console.log("\ntidak ada yang perlu dipindah.")
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-ssd-category-${stamp}.json`)
  writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), moves }, null, 2))
  console.log(`\nbackup ditulis: ${backupPath}`)

  await prisma.$transaction(async (tx) => {
    for (const m of moves) {
      await tx.productCategory.delete({
        where: { productId_categoryId: { productId: m.productId, categoryId: m.from } },
      })
      await tx.productCategory.upsert({
        where: { productId_categoryId: { productId: m.productId, categoryId: m.to } },
        create: { productId: m.productId, categoryId: m.to },
        update: {},
      })
    }
  })

  console.log(`\nSELESAI. produk dipindah: ${moves.length}`)
  console.log(`Rollback: ${backupPath}`)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
