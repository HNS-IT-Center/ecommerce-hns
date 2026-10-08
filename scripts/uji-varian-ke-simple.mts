/**
 * Verifikasi B1: produk bervariasi bisa diubah jadi produk biasa.
 *
 * MENULIS ke database yang sedang aktif — jalankan di Docker lokal saja
 * (docs/16), bukan produksi. Memakai produk buangan "ZZ TEST" yang dihapus
 * lagi di akhir, berhasil maupun gagal.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-varian-ke-simple.mts
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const { createProduct, updateProduct, deleteProduct, ProductVariationError } = await import(
  "../src/lib/api/woocommerce/products"
)
const { diffProductChanges, buildProductLogEntries } = await import("../src/lib/logs/product-log")

/**
 * `revalidateTag` hanya hidup di dalam Next dan melempar di skrip. Ia dipanggil
 * SESUDAH transaksi database selesai, jadi galatnya aman diabaikan di sini —
 * yang diuji adalah isi database, bukan cache.
 */
async function abaikanCache<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof Error && error.message.includes("static generation store missing")) return undefined
    throw error
  }
}

const NAMA = "ZZ TEST Varian Ke Simple"

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}

const prisma = getPrisma()
let wooId: number | undefined

try {
  // Sisa run sebelumnya yang terhenti di tengah jalan.
  for (const sisa of await prisma.product.findMany({ where: { name: NAMA }, select: { wooId: true } })) {
    await abaikanCache(() => deleteProduct(sisa.wooId))
  }

  await abaikanCache(() => createProduct({
    name: NAMA,
    type: "variable",
    status: "draft",
    variation_attributes: ["WARNA"],
    variations: [
      { attributes: { WARNA: "HITAM" }, regular_price: "150000", stock_status: "instock" },
      { attributes: { WARNA: "PUTIH" }, regular_price: "160000", stock_status: "instock" },
    ],
  }))
  const induk = await prisma.product.findFirstOrThrow({ where: { name: NAMA } })
  wooId = induk.wooId
  const id = wooId
  cek("awal: tipe VARIABLE", induk.type, "VARIABLE")
  cek("awal: 2 varian", await prisma.product.count({ where: { parentId: induk.id } }), 2)

  // 1. Tanpa persetujuan: tetap ditolak, tidak ada yang berubah.
  let ditolak = false
  try {
    await abaikanCache(() => updateProduct(id, { type: "simple", regular_price: "155000" }))
  } catch (error) {
    ditolak = error instanceof ProductVariationError
  }
  cek("tanpa remove_variations: ditolak ProductVariationError", ditolak, true)
  const setelahTolak = await prisma.product.findUniqueOrThrow({ where: { wooId } })
  cek("tanpa remove_variations: tipe tetap VARIABLE", setelahTolak.type, "VARIABLE")
  cek("tanpa remove_variations: varian tetap 2", await prisma.product.count({ where: { parentId: induk.id } }), 2)

  // 2. Log: nilai lama menyebut jumlah varian yang hilang.
  const input = { type: "simple" as const, regular_price: "155000", remove_variations: true }
  const entri = buildProductLogEntries(
    diffProductChanges({ ...setelahTolak, categories: [], images: [], variationCount: 2 }, input),
  )
  const editEntri = entri.find((e) => e.action === "EDIT_PRODUCT")
  cek("log: field type tercatat", editEntri?.fieldAffected, "type")
  cek("log: nilai lama", editEntri?.oldValue, "variable (2 varian)")
  cek("log: nilai baru", editEntri?.newValue, "simple, varian dihapus")

  // 3. Dengan persetujuan: tipe turun, varian hilang, harga induk terpakai.
  await abaikanCache(() => updateProduct(id, input))
  const akhir = await prisma.product.findUniqueOrThrow({ where: { wooId } })
  cek("dengan remove_variations: tipe SIMPLE", akhir.type, "SIMPLE")
  cek("dengan remove_variations: varian 0", await prisma.product.count({ where: { parentId: induk.id } }), 0)
  cek("dengan remove_variations: harga 155000", String(akhir.regularPrice), "155000")
  cek(
    "tidak ada baris varian yatim bernama ZZ TEST",
    await prisma.product.count({ where: { name: { startsWith: "ZZ TEST Varian Ke Simple -" } } }),
    0,
  )
} finally {
  const sisa = wooId
  if (sisa !== undefined) {
    await abaikanCache(() => deleteProduct(sisa)).catch((e) => console.error("Bersih-bersih gagal:", e))
  }
  await prisma.$disconnect()
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
