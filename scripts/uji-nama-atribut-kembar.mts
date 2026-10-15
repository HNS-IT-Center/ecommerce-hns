/**
 * Verifikasi: nama atribut bertitik dua ("CPU Socket Type:") tidak lagi
 * melahirkan atribut kembar saat produk disimpan, melainkan jatuh ke atribut
 * aslinya — yang dipakai PC Builder untuk menyaring kompatibilitas.
 *
 * MENULIS ke database yang sedang aktif — jalankan di Docker lokal saja
 * (docs/16), bukan produksi. Memakai produk buangan "ZZ TEST" yang dihapus
 * lagi di akhir, berhasil maupun gagal.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-nama-atribut-kembar.mts
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const { createProduct, updateProduct, deleteProduct } = await import("../src/lib/api/woocommerce/products")

const NAMA_SIMPLE = "ZZ TEST Nama Atribut Kembar"
const NAMA_VARIABLE = "ZZ TEST Nama Atribut Kembar Varian"

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}

const prisma = getPrisma()
const dibuat: number[] = []

/** Pasangan nama-atribut=nilai milik satu produk, terurut supaya bisa dibandingkan. */
async function atributProduk(productId: number): Promise<string[]> {
  const baris = await prisma.productAttribute.findMany({
    where: { productId },
    include: { attribute: true, value: true },
  })
  return baris.map((b) => `${b.attribute.name}=${b.value.value}`).sort()
}

try {
  for (const sisa of await prisma.product.findMany({
    where: { name: { in: [NAMA_SIMPLE, NAMA_VARIABLE] } },
    select: { wooId: true },
  })) {
    await deleteProduct(sisa.wooId)
  }

  const socketAsli = await prisma.attribute.findUnique({ where: { name: "CPU Socket Type" } })
  const warnaAsli = await prisma.attribute.findUnique({ where: { name: "WARNA" } })
  cek("prasyarat: atribut \"CPU Socket Type\" ada", Boolean(socketAsli), true)
  cek("prasyarat: atribut \"WARNA\" ada", Boolean(warnaAsli), true)
  const jumlahAtributAwal = await prisma.attribute.count()

  // 1. Produk biasa: baris "CPU Socket Type:" DAN "CPU Socket Type" bernilai
  //    sama. Dulu baris pertama melahirkan atribut baru; sekarang keduanya
  //    harus jatuh ke satu atribut, tercatat sekali, tanpa unique violation.
  await createProduct({
    name: NAMA_SIMPLE,
    status: "draft",
    regular_price: "100000",
    attributes: [
      { name: "CPU Socket Type:", options: ["LGA 1700"] },
      { name: "CPU Socket Type", options: ["LGA 1700"] },
      { name: "  DDR  ", options: ["DDR 4"] },
    ],
  })
  const simple = await prisma.product.findFirstOrThrow({ where: { name: NAMA_SIMPLE } })
  dibuat.push(simple.wooId)
  cek("buat: atribut tercatat di atribut asli, sekali", await atributProduk(simple.id), [
    "CPU Socket Type=LGA 1700",
    "DDR=DDR 4",
  ])
  cek(
    "buat: socket memakai id atribut asli",
    (await prisma.productAttribute.findFirst({ where: { productId: simple.id, attributeId: socketAsli?.id } }))
      ?.attributeId,
    socketAsli?.id,
  )

  // 2. Jalur sunting — yang dipakai staff saat merapikan produk lama.
  await updateProduct(simple.wooId, {
    attributes: [
      { name: "CPU Socket Type :", options: ["LGA 1851"] },
      { name: "Motherboard Size::", options: ["micro-ATX"] },
    ],
  })
  cek("sunting: atribut tercatat di atribut asli", await atributProduk(simple.id), [
    "CPU Socket Type=LGA 1851",
    "Motherboard Size=micro-ATX",
  ])

  // 3. Produk bervarian: atribut pembeda "WARNA:" harus jatuh ke "WARNA",
  //    di induk maupun di tiap varian.
  await createProduct({
    name: NAMA_VARIABLE,
    type: "variable",
    status: "draft",
    variation_attributes: ["WARNA:"],
    variations: [
      { attributes: { "WARNA:": "HITAM" }, regular_price: "150000", stock_status: "instock" },
      { attributes: { "WARNA:": "PUTIH" }, regular_price: "160000", stock_status: "instock" },
    ],
  })
  const induk = await prisma.product.findFirstOrThrow({ where: { name: NAMA_VARIABLE } })
  dibuat.push(induk.wooId)
  const atributInduk = await atributProduk(induk.id)
  cek("varian: induk memakai WARNA asli", atributInduk.every((a) => a.startsWith("WARNA=")) && atributInduk.length === 2, true)
  const varian = await prisma.product.findMany({ where: { parentId: induk.id }, select: { id: true } })
  const atributVarian = (await Promise.all(varian.map((v) => atributProduk(v.id)))).flat()
  cek("varian: tiap varian memakai WARNA asli", atributVarian.length === 2 && atributVarian.every((a) => a.startsWith("WARNA=")), true)

  cek("tidak ada atribut baru yang lahir", await prisma.attribute.count(), jumlahAtributAwal)
} finally {
  for (const wooId of dibuat) {
    await deleteProduct(wooId).catch((e) => console.error("Bersih-bersih gagal:", e))
  }
  await prisma.$disconnect()
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
