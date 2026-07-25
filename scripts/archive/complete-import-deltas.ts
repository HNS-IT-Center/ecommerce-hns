// Lengkapi 3 tabel yang kurang dari import CSV sebelumnya (attribute_values,
// product_attributes, import_quarantine) — HANYA insert baris yang belum ada,
// tabel lain yang sudah pas (products, categories, brands, dst) tidak disentuh.
import fs from "fs"
import { parse } from "csv-parse/sync"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

// require (bukan import statik) supaya jalan setelah dotenv.config() —
// src/config/env.ts (Zod parse saat modul di-load) butuh DATABASE_URL dkk
// sudah ter-inject duluan.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPrisma } = require("../src/lib/prisma/client")
const prisma = getPrisma()

// Dijalankan sekali (2026-07-25) untuk melengkapi import CSV yang sempat parsial.
// Path folder CSV sumber diberikan lewat argumen CLI, bukan hardcode -> script
// aman di-commit tanpa membocorkan path lokal siapapun.
// Pemakaian: npx tsx scripts/archive/complete-import-deltas.ts "<path folder csv>"
const CSV_DIR = process.argv[2]
if (!CSV_DIR) {
  console.error("Usage: npx tsx scripts/archive/complete-import-deltas.ts <path folder csv>")
  process.exit(1)
}

function readCsv(filename: string) {
  const content = fs.readFileSync(`${CSV_DIR}/${filename}`, "utf-8")
  return parse(content, { columns: true, skip_empty_lines: true })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function insertMissing<T>(
  label: string,
  rows: T[],
  _createMany: (batch: T[]) => Promise<unknown>,
  createOne: (row: T) => Promise<unknown>
) {
  console.log(`\n[${label}] Mencoba insert ${rows.length} baris yang kurang (satu-satu, createMany+skipDuplicates ternyata tidak reliable di adapter mariadb ini)...`)
  let ok = 0
  const failed: { row: T; error: string }[] = []

  for (const row of rows) {
    try {
      await createOne(row)
      ok += 1
    } catch (e) {
      failed.push({ row, error: e instanceof Error ? e.message : String(e) })
    }
  }

  console.log(`[${label}] Berhasil insert: ${ok}. Gagal: ${failed.length}`)
  if (failed.length > 0) {
    console.log(`[${label}] Contoh baris gagal (maks 5):`)
    for (const f of failed.slice(0, 5)) {
      console.log(`  ${JSON.stringify(f.row)} -> ${f.error}`)
    }
  }
  return failed
}

// id di CSV yang TIDAK ada di DB tapi (attributeId, value) case-insensitive-nya
// SUDAH ada (mis. "BLACK" vs "Black" yang sudah lebih dulu masuk) -> map ke id
// yang sudah ada itu, bukan dianggap baris hilang.
async function buildAttributeValueRemap() {
  const csvRows = readCsv("attribute_values.csv") as { id: string; attribute_id: string; value: string }[]
  const existing = await prisma.attributeValue.findMany({ select: { id: true, attributeId: true, value: true } })
  const existingIds = new Set(existing.map((r) => r.id))
  const canonicalByKey = new Map<string, number>()
  for (const r of existing) {
    canonicalByKey.set(`${r.attributeId}::${r.value.toLowerCase().trim()}`, r.id)
  }

  const remap = new Map<number, number>()
  const trulyMissing: { id: string; attribute_id: string; value: string }[] = []

  for (const r of csvRows) {
    const id = Number(r.id)
    if (existingIds.has(id)) continue
    const canonical = canonicalByKey.get(`${r.attribute_id}::${r.value.toLowerCase().trim()}`)
    if (canonical) {
      remap.set(id, canonical)
    } else {
      trulyMissing.push(r)
    }
  }
  return { remap, trulyMissing }
}

async function completeAttributeValues() {
  const { remap, trulyMissing } = await buildAttributeValueRemap()

  console.log(`\n[attribute_values] ${remap.size} id CSV adalah duplikat case-insensitive dari id yang sudah ada (di-remap, bukan diinsert):`)
  for (const [origId, canonicalId] of remap) {
    console.log(`  csv id ${origId} -> db id ${canonicalId} (sudah ada)`)
  }

  await insertMissing(
    "attribute_values (benar-benar baru)",
    trulyMissing,
    (batch) =>
      prisma.attributeValue.createMany({
        data: batch.map((r) => ({ id: Number(r.id), attributeId: Number(r.attribute_id), value: r.value })),
        skipDuplicates: true,
      }),
    (r) =>
      prisma.attributeValue.create({
        data: { id: Number(r.id), attributeId: Number(r.attribute_id), value: r.value },
      })
  )

  return remap
}

async function completeProductAttributes(attributeValueRemap: Map<number, number>) {
  const csvRows = readCsv("product_attributes.csv") as {
    product_woo_id: string
    attribute_id: string
    value_id: string
    position: string
  }[]

  const products = await prisma.product.findMany({ select: { id: true, wooId: true } })
  const wooIdToId = new Map(products.map((p) => [p.wooId, p.id]))

  const existing = await prisma.productAttribute.findMany({
    select: { productId: true, attributeId: true, valueId: true },
  })
  const existingKeys = new Set(existing.map((r) => `${r.productId}-${r.attributeId}-${r.valueId}`))

  const missing: { productId: number; attributeId: number; valueId: number; position: number }[] = []
  let unmappedWooId = 0

  for (const r of csvRows) {
    const productId = wooIdToId.get(Number(r.product_woo_id))
    if (!productId) {
      unmappedWooId += 1
      continue
    }
    const attributeId = Number(r.attribute_id)
    const rawValueId = Number(r.value_id)
    const valueId = attributeValueRemap.get(rawValueId) ?? rawValueId
    const key = `${productId}-${attributeId}-${valueId}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key) // hindari duplikat dalam CSV itu sendiri
    missing.push({ productId, attributeId, valueId, position: Number(r.position) || 0 })
  }

  if (unmappedWooId > 0) {
    console.log(`[product_attributes] ${unmappedWooId} baris CSV woo_id-nya tidak ditemukan di tabel products.`)
  }

  return insertMissing(
    "product_attributes",
    missing,
    (batch) => prisma.productAttribute.createMany({ data: batch, skipDuplicates: true }),
    (r) => prisma.productAttribute.create({ data: r })
  )
}

async function completeImportQuarantine() {
  const csvRows = readCsv("import_quarantine.csv") as { woo_id: string; issue: string; raw_name: string }[]
  const existing = await prisma.importQuarantine.findMany({ select: { wooId: true, issues: true } })
  const existingKeys = new Set(existing.map((r) => `${r.wooId}||${r.issues}`))

  const missing: { rowNumber: number; wooId: string; issues: string; rawData: string }[] = []
  for (const r of csvRows) {
    const key = `${r.woo_id}||${r.issue}`
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    missing.push({ rowNumber: 0, wooId: r.woo_id, issues: r.issue, rawData: r.raw_name })
  }

  return insertMissing(
    "import_quarantine",
    missing,
    (batch) => prisma.importQuarantine.createMany({ data: batch }),
    (r) => prisma.importQuarantine.create({ data: r })
  )
}

async function main() {
  const remap = await completeAttributeValues()
  await completeProductAttributes(remap)
  await completeImportQuarantine()

  console.log("\n--- Recount (koneksi yang sama) ---")
  console.log("attribute_values:", await prisma.attributeValue.count())
  console.log("product_attributes:", await prisma.productAttribute.count())
  console.log("import_quarantine:", await prisma.importQuarantine.count())

  console.log("\nSelesai.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
