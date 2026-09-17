/**
 * Verifikasi input SKU produk induk — jalur tulis Prisma yang sebelumnya tidak
 * ada sama sekali.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-sku-produk.mts
 *
 * `--tsconfig` WAJIB: rantai impor `products.ts` menyentuh modul bertanda
 * `server-only`, dan paket itu tidak ada di `node_modules` (Next
 * menyelesaikannya di bundler). Lihat catatan di `scripts/tsconfig.uji.json`.
 *
 * Yang diuji adalah FUNGSI SUNGGUHAN (`createProduct`, `updateProduct`,
 * `diffProductChanges`), bukan salinan SQL-nya — persis alasan yang sama
 * seperti `uji-fase3-harga-accurate.mts`: yang perlu dibuktikan adalah perilaku
 * kode yang benar-benar dipanggil panel admin.
 *
 * `DATABASE_URL` ditimpa ke database uji SEBELUM modulnya diimpor. Kalau
 * `RESTORE_UJI_DATABASE_URL` tidak ada, skrip berhenti — ia TIDAK pernah jatuh
 * ke produksi.
 *
 * Yang dibuktikan:
 *   1. SKU dari form benar-benar tersimpan (dulu dibuang tanpa jejak)
 *   2. SKU kosong tersimpan sebagai NULL, BUKAN "" — dan dua produk tanpa SKU
 *      bisa hidup bersama (jebakan kolom unik)
 *   3. spasi di ujung dibuang, besar-kecil huruf TIDAK diubah
 *   4. SKU kembar ditolak dengan pesan yang menyebut pemiliknya
 *   5. SKU kembar dengan SKU VARIAN juga ditolak (satu ruang unik)
 *   6. menyimpan tanpa mengirim `sku` TIDAK mengosongkan SKU tersimpan
 *      (jalur harga cepat & sinkronisasi harga lewat sini)
 *   7. mengirim `sku` kosong memang menghapusnya
 *   8. menyimpan produk tanpa mengubah SKU-nya tidak dianggap bentrok sendiri
 *   9. perubahan SKU tercatat di log produk
 */
import { readFileSync } from "node:fs"

const isiEnv = readFileSync(".env.local", "utf8")
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}

const uji = process.env.RESTORE_UJI_DATABASE_URL
if (!uji) {
  console.error(
    "RESTORE_UJI_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).",
  )
  process.exit(1)
}
process.env.DATABASE_URL = uji

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { createProduct, updateProduct, ProductSkuError } = await import(
  "../src/lib/api/woocommerce/products.ts"
)
const { diffProductChanges } = await import("../src/lib/logs/product-log.ts")

const prisma = getPrisma()
const namaDb = new URL(uji.replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb}  (uji — bukan produksi)\n`)

let lulus = 0
let gagal = 0
function cek(nama: string, benar: boolean, detail = "") {
  if (benar) {
    lulus++
    console.log(`  OK    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${detail ? ` — ${detail}` : ""}`)
  }
}

const NAMA_AWALAN = "ZZ TEST SKU"
const SKU_AWALAN = "ZZTESTSKU"

/**
 * `invalidateProductCaches` memanggil `revalidateTag`, yang di luar konteks
 * permintaan Next bisa melempar. Ia dijalankan SETELAH transaksi commit, jadi
 * kegagalannya tidak memengaruhi apa pun yang diuji di sini — tapi juga tidak
 * boleh ditelan buta, karena galat lain di jalur yang sama akan hilang.
 *
 * Karena itu hanya galat cache yang dilewati, dan kalau memang terlewat, produk
 * hasil tulisnya dibaca ulang langsung dari database.
 */
function galatCache(error: unknown): boolean {
  const pesan = error instanceof Error ? error.message : String(error)
  return /revalidate|cache|static generation store|request scope/i.test(pesan)
}

async function bersihkan() {
  const uji = await prisma.product.findMany({
    where: { OR: [{ name: { startsWith: NAMA_AWALAN } }, { sku: { startsWith: SKU_AWALAN } }] },
    select: { id: true },
  })
  const ids = uji.map((p) => p.id)
  if (ids.length === 0) return
  await prisma.productLog.deleteMany({ where: { productId: { in: ids } } })
  await prisma.productCategory.deleteMany({ where: { productId: { in: ids } } })
  await prisma.productAttribute.deleteMany({ where: { productId: { in: ids } } })
  await prisma.productImage.deleteMany({ where: { productId: { in: ids } } })
  // Anak dulu, baru induk — parentId memakai SetNull, jadi urutan terbalik
  // meninggalkan varian yatim yang namanya tidak lagi berawalan ZZ TEST.
  await prisma.product.deleteMany({ where: { parentId: { in: ids } } })
  await prisma.product.deleteMany({ where: { id: { in: ids } } })
}

/** Membuat produk uji, melewati kegagalan cache di luar konteks permintaan. */
async function buat(nama: string, sku: string | undefined) {
  try {
    return await createProduct({
      name: nama,
      type: "simple",
      status: "draft",
      sku,
      regular_price: "1000000",
      categories: [],
    })
  } catch (error) {
    if (!galatCache(error)) throw error
    return null
  }
}

async function ubah(wooId: number, input: Parameters<typeof updateProduct>[1]) {
  try {
    return await updateProduct(wooId, input)
  } catch (error) {
    if (!galatCache(error)) throw error
    return null
  }
}

const bacaSku = (nama: string) =>
  prisma.product.findFirst({ where: { name: nama }, select: { id: true, wooId: true, sku: true } })

try {
  await bersihkan()

  // ── 1. SKU tersimpan ──────────────────────────────────────────────────────
  console.log("1. SKU dari form benar-benar tersimpan:")
  const namaA = `${NAMA_AWALAN} A`
  await buat(namaA, `${SKU_AWALAN}-A`)
  const a = await bacaSku(namaA)
  cek("produk terbuat", a !== null)
  cek(`sku tersimpan "${SKU_AWALAN}-A"`, a?.sku === `${SKU_AWALAN}-A`, String(a?.sku))

  // ── 2. kosong = NULL, dan boleh lebih dari satu ───────────────────────────
  console.log("\n2. SKU kosong tersimpan NULL, bukan \"\" (jebakan kolom unik):")
  const namaB = `${NAMA_AWALAN} B tanpa sku`
  const namaC = `${NAMA_AWALAN} C tanpa sku`
  await buat(namaB, "")
  const b = await bacaSku(namaB)
  cek("sku kosong jadi NULL", b?.sku === null, JSON.stringify(b?.sku))

  let produkKeduaTanpaSkuGagal: string | null = null
  try {
    await buat(namaC, "   ")
  } catch (error) {
    produkKeduaTanpaSkuGagal = error instanceof Error ? error.message : String(error)
  }
  const c = await bacaSku(namaC)
  cek(
    "produk KEDUA tanpa SKU tetap bisa disimpan",
    produkKeduaTanpaSkuGagal === null && c !== null,
    produkKeduaTanpaSkuGagal ?? "produknya tidak terbuat",
  )
  cek("spasi-saja juga jadi NULL", c?.sku === null, JSON.stringify(c?.sku))

  // ── 3. trim, tanpa mengubah huruf ─────────────────────────────────────────
  console.log("\n3. Spasi ujung dibuang, besar-kecil huruf dibiarkan:")
  const namaD = `${NAMA_AWALAN} D`
  await buat(namaD, `  ${SKU_AWALAN}-d-KeCiL  `)
  const d = await bacaSku(namaD)
  cek("spasi ujung dibuang", d?.sku === `${SKU_AWALAN}-d-KeCiL`, String(d?.sku))
  cek("huruf TIDAK dinaikkan jadi kapital", d?.sku?.includes("KeCiL") === true, String(d?.sku))

  // ── 4. SKU kembar ditolak, pemiliknya disebut ─────────────────────────────
  console.log("\n4. SKU kembar ditolak dengan pesan yang menyebut pemiliknya:")
  let galatKembar: unknown = null
  try {
    await buat(`${NAMA_AWALAN} E kembar`, `${SKU_AWALAN}-A`)
  } catch (error) {
    galatKembar = error
  }
  cek("ditolak sebagai ProductSkuError", galatKembar instanceof ProductSkuError, String(galatKembar))
  cek(
    "pesannya menyebut nama produk pemiliknya",
    galatKembar instanceof Error && galatKembar.message.includes(namaA),
    galatKembar instanceof Error ? galatKembar.message : "",
  )
  const kembarTerbuat = await bacaSku(`${NAMA_AWALAN} E kembar`)
  cek("produk kembarnya TIDAK ikut terbuat", kembarTerbuat === null)

  // ── 5. ruang unik dibagi dengan varian ────────────────────────────────────
  console.log("\n5. SKU varian berbagi ruang unik yang sama:")
  const namaVarian = `${NAMA_AWALAN} F induk`
  await buat(namaVarian, undefined)
  const f = await bacaSku(namaVarian)
  await prisma.product.create({
    data: {
      wooId: (f?.wooId ?? 0) + 500000,
      parentId: f?.id,
      type: "VARIATION",
      status: "DRAFT",
      name: `${NAMA_AWALAN} F induk - MERAH`,
      slug: `zz-test-sku-f-merah-${Date.now()}`,
      sku: `${SKU_AWALAN}-VAR`,
      regularPrice: "1000000",
    },
  })
  let galatVarian: unknown = null
  try {
    await buat(`${NAMA_AWALAN} G rebut sku varian`, `${SKU_AWALAN}-VAR`)
  } catch (error) {
    galatVarian = error
  }
  cek("bentrok dengan SKU varian ditolak", galatVarian instanceof ProductSkuError, String(galatVarian))
  cek(
    "pesannya menyebut kata \"varian\"",
    galatVarian instanceof Error && /varian/i.test(galatVarian.message),
    galatVarian instanceof Error ? galatVarian.message : "",
  )

  // ── 6. field tidak dikirim = SKU dibiarkan ────────────────────────────────
  console.log("\n6. Menyimpan TANPA mengirim `sku` tidak mengosongkannya:")
  await ubah(a!.wooId, { regular_price: "2000000" })
  const aSetelahHarga = await bacaSku(namaA)
  cek(
    "sku masih utuh setelah update harga saja",
    aSetelahHarga?.sku === `${SKU_AWALAN}-A`,
    String(aSetelahHarga?.sku),
  )

  // ── 7. dikirim kosong = dihapus ───────────────────────────────────────────
  console.log("\n7. Mengirim `sku` kosong memang menghapusnya:")
  await ubah(d!.wooId, { sku: "" })
  const dSetelah = await bacaSku(namaD)
  cek("sku jadi NULL", dSetelah?.sku === null, JSON.stringify(dSetelah?.sku))

  // ── 8. tidak bentrok dengan diri sendiri ──────────────────────────────────
  console.log("\n8. Menyimpan SKU yang sama ke produk yang sama tidak dianggap bentrok:")
  let galatDiriSendiri: unknown = null
  try {
    await ubah(a!.wooId, { sku: `${SKU_AWALAN}-A`, name: `${namaA}` })
  } catch (error) {
    galatDiriSendiri = error
  }
  cek("tidak melempar", galatDiriSendiri === null, String(galatDiriSendiri))

  console.log("\n   dan SKU milik produk LAIN tetap ditolak saat menyunting:")
  let galatUbahKembar: unknown = null
  try {
    await ubah(b!.wooId, { sku: `${SKU_AWALAN}-A` })
  } catch (error) {
    galatUbahKembar = error
  }
  cek("ditolak", galatUbahKembar instanceof ProductSkuError, String(galatUbahKembar))
  const bSetelah = await bacaSku(namaB)
  cek("SKU produk B tidak ikut berubah", bSetelah?.sku === null, JSON.stringify(bSetelah?.sku))

  // ── 9. tercatat di log produk ─────────────────────────────────────────────
  console.log("\n9. Perubahan SKU tercatat di log produk:")
  const perubahan = diffProductChanges(
    {
      name: "X",
      sku: "LAMA",
      status: "DRAFT",
      shortDescription: null,
      description: null,
      regularPrice: null,
      salePrice: null,
      stockStatus: null,
      stockQty: null,
      categories: [],
      images: [],
    },
    { sku: "BARU" },
  )
  cek("satu perubahan terdeteksi", perubahan.length === 1, JSON.stringify(perubahan))
  cek("field-nya \"sku\"", perubahan[0]?.field === "sku", String(perubahan[0]?.field))
  cek("nilai lama & baru terbawa", perubahan[0]?.old === "LAMA" && perubahan[0]?.new === "BARU")

  const takBerubah = diffProductChanges(
    {
      name: "X",
      sku: "SAMA",
      status: "DRAFT",
      shortDescription: null,
      description: null,
      regularPrice: null,
      salePrice: null,
      stockStatus: null,
      stockQty: null,
      categories: [],
      images: [],
    },
    { sku: "  SAMA  " },
  )
  cek("spasi ujung tidak dianggap perubahan", takBerubah.length === 0, JSON.stringify(takBerubah))
} finally {
  await bersihkan()
  const sisa = await prisma.product.count({
    where: { OR: [{ name: { startsWith: NAMA_AWALAN } }, { sku: { startsWith: SKU_AWALAN } }] },
  })
  console.log(
    `\nPembersihan: ${sisa === 0 ? "bersih, tidak ada sisa ZZ TEST" : `MASIH ADA ${sisa} SISA — periksa manual`}`,
  )
  await prisma.$disconnect()
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal === 0 ? 0 : 1)
