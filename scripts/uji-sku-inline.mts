/**
 * Verifikasi penyuntingan SKU dari daftar produk.
 *
 * Menguji lapisan yang benar-benar menulis (`updateProduct`), bukan server
 * action-nya: action membungkusnya dengan `requirePermission`, yang butuh sesi
 * dan tidak bisa dipanggil dari Node.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-sku-inline.mts
 *
 * MENULIS ke database, tapi hanya pada produk buangan berawalan "ZZ TEST" yang
 * dibuat dan dihapus sendiri oleh skrip ini — mengikuti konvensi verifikasi
 * project. Produk sungguhan tidak pernah disentuh; pembersihannya berjalan di
 * blok `finally` sehingga tetap terjadi walau ada uji yang gagal di tengah.
 *
 * Yang dibuktikan, berurutan dari yang paling mudah rusak:
 *
 *  1. SKU tersimpan, berubah, dan bisa dikosongkan kembali jadi NULL.
 *  2. SKU bentrok DITOLAK, dan pesannya menyebut produk pemiliknya.
 *  3. Bentrok dengan SKU milik VARIAN produk lain juga ditolak — varian berbagi
 *     satu ruang unik dengan induk.
 *  4. Dua produk boleh sama-sama ber-SKU NULL.
 *  5. SLUG TIDAK BERGESER saat menyimpan tanpa mengubah nama. Ini yang paling
 *     penting: `ProductInput.name` wajib diisi, jadi penyuntingan SKU (dan
 *     harga) ikut mengirim nama yang sama, dan sebelum perbaikan itu membuat
 *     slug dihitung ulang — mengubah ALAMAT 2.693 dari 3.330 produk.
 *  6. Slug TETAP berubah kalau namanya memang diganti — perbaikan di atas tidak
 *     boleh ikut mematikan perilaku yang benar.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { getPrisma } = await import("../src/lib/prisma/client")
const { updateProduct } = await import("../src/lib/api/woocommerce/products")
const { tautkanKode } = await import("../src/lib/api/accurate/price-table")

const prisma = getPrisma()

const KODE_ACC = "ZZ-TEST-KODE-ACC"

const WOO_A = 990000101
const WOO_B = 990000102
const WOO_VAR = 990000103

let lolos = 0
let gagal = 0
function cek(nama: string, syarat: boolean, ket = "") {
  if (syarat) {
    lolos++
    console.log(`  OK    ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${ket ? " — " + ket : ""}`)
  }
}

const skuDari = async (woo: number) => {
  const r = await prisma.$queryRawUnsafe<{ sku: string | null }[]>(
    "SELECT sku FROM products WHERE woo_id = ?",
    woo,
  )
  return r[0]?.sku ?? null
}
const slugDari = async (woo: number) => {
  const r = await prisma.$queryRawUnsafe<{ slug: string }[]>(
    "SELECT slug FROM products WHERE woo_id = ?",
    woo,
  )
  return r[0]?.slug ?? ""
}

async function bersihkan() {
  await prisma.$executeRawUnsafe(
    "DELETE FROM products WHERE woo_id IN (?, ?, ?)",
    WOO_A,
    WOO_B,
    WOO_VAR,
  )
  await prisma.$executeRawUnsafe(
    "DELETE FROM accurate_products WHERE `Kode Accurate` = ?",
    KODE_ACC,
  )
}

try {
  await bersihkan()

  // Slug sengaja TIDAK berbentuk hasil slugify (tanpa akhiran -wooId), meniru
  // mayoritas katalog: itu justru bentuk yang akan bergeser kalau slug dihitung
  // ulang tanpa alasan.
  await prisma.$executeRawUnsafe(
    `INSERT INTO products (woo_id, name, slug, type, status, visibility, source, stock_status)
     VALUES (?, 'ZZ TEST Produk A', 'zz-test-produk-a', 'SIMPLE', 'DRAFT', 'HIDDEN', 'LOCAL', 'IN_STOCK'),
            (?, 'ZZ TEST Produk B', 'zz-test-produk-b', 'SIMPLE', 'DRAFT', 'HIDDEN', 'LOCAL', 'IN_STOCK')`,
    WOO_A,
    WOO_B,
  )
  const indukB = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "SELECT id FROM products WHERE woo_id = ?",
    WOO_B,
  )
  await prisma.$executeRawUnsafe(
    `INSERT INTO products (woo_id, name, slug, type, status, visibility, source, stock_status, parent_id, sku)
     VALUES (?, 'ZZ TEST Varian B1', 'zz-test-varian-b1', 'SIMPLE', 'DRAFT', 'HIDDEN', 'LOCAL', 'IN_STOCK', ?, 'ZZ-SKU-VARIAN')`,
    WOO_VAR,
    indukB[0]!.id,
  )

  console.log("\n1. Menyimpan SKU baru")
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A", sku: "ZZ-SKU-001" })
  cek("tersimpan", (await skuDari(WOO_A)) === "ZZ-SKU-001", String(await skuDari(WOO_A)))

  console.log("\n2. Mengubah SKU")
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A", sku: "ZZ-SKU-002" })
  cek("berubah", (await skuDari(WOO_A)) === "ZZ-SKU-002", String(await skuDari(WOO_A)))

  console.log("\n3. Mengosongkan SKU -> NULL, bukan string kosong")
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A", sku: "" })
  cek("jadi NULL", (await skuDari(WOO_A)) === null, JSON.stringify(await skuDari(WOO_A)))

  console.log("\n4. Dua produk boleh sama-sama NULL")
  await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "" })
  cek("keduanya NULL", (await skuDari(WOO_A)) === null && (await skuDari(WOO_B)) === null)

  console.log("\n5. SKU bentrok ditolak, menyebut pemiliknya")
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A", sku: "ZZ-SKU-DIPAKAI" })
  let pesanBentrok = ""
  try {
    await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "ZZ-SKU-DIPAKAI" })
  } catch (e) {
    pesanBentrok = e instanceof Error ? e.message : String(e)
  }
  cek("ditolak", pesanBentrok !== "", "malah diterima")
  cek("menyebut produk pemiliknya", pesanBentrok.includes("ZZ TEST Produk A"), pesanBentrok.slice(0, 80))
  cek("SKU B tidak ikut berubah", (await skuDari(WOO_B)) === null, String(await skuDari(WOO_B)))

  console.log("\n6. Bentrok dengan SKU milik VARIAN produk lain juga ditolak")
  let pesanVarian = ""
  try {
    await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "ZZ-SKU-VARIAN" })
  } catch (e) {
    pesanVarian = e instanceof Error ? e.message : String(e)
  }
  cek("ditolak", pesanVarian !== "", "malah diterima — varian berbagi ruang unik dengan induk")

  console.log("\n7. SLUG TIDAK bergeser saat nama tidak berubah")
  const slugSebelum = await slugDari(WOO_A)
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A", sku: "ZZ-SKU-003" })
  const slugSesudah = await slugDari(WOO_A)
  cek("slug tetap", slugSebelum === slugSesudah, `"${slugSebelum}" -> "${slugSesudah}"`)
  cek("slug masih bentuk aslinya", slugSesudah === "zz-test-produk-a", slugSesudah)

  console.log("\n8. Slug TETAP berubah kalau namanya memang diganti")
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A Diganti" })
  const slugGanti = await slugDari(WOO_A)
  cek("slug ikut berubah", slugGanti !== "zz-test-produk-a", slugGanti)
  cek("memakai nama baru", slugGanti.startsWith("zz-test-produk-a-diganti"), slugGanti)

  // ---------------------------------------------- pengisian SKU saat menautkan

  await prisma.$executeRawUnsafe(
    "INSERT INTO accurate_products (`Kode Accurate`, `NAMA BARANG`, `STATUS`) VALUES (?, 'ZZ TEST Barang Accurate', 'TIDAK')",
    KODE_ACC,
  )

  console.log("\n9. Menautkan TANPA isiSku — SKU tidak disentuh")
  await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "" })
  const r9 = await tautkanKode(WOO_B, KODE_ACC)
  cek("tertaut", r9.ok, r9.ok ? "" : r9.alasan)
  cek("SKU tetap kosong", (await skuDari(WOO_B)) === null, String(await skuDari(WOO_B)))

  console.log("\n10. Menautkan DENGAN isiSku — SKU terisi kode Accurate")
  await tautkanKode(WOO_B, null)
  const r10 = await tautkanKode(WOO_B, KODE_ACC, { isiSku: true })
  cek("tertaut", r10.ok, r10.ok ? "" : r10.alasan)
  cek("SKU terisi", (await skuDari(WOO_B)) === KODE_ACC, String(await skuDari(WOO_B)))
  cek("dilaporkan lewat skuDiisi", r10.ok && r10.skuDiisi === KODE_ACC, JSON.stringify(r10))

  console.log("\n11. SKU yang SUDAH ada tidak ditimpa")
  await tautkanKode(WOO_B, null)
  await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "ZZ-SKU-PABRIKAN" })
  const r11 = await tautkanKode(WOO_B, KODE_ACC, { isiSku: true })
  cek("tertaut", r11.ok)
  cek("SKU lama bertahan", (await skuDari(WOO_B)) === "ZZ-SKU-PABRIKAN", String(await skuDari(WOO_B)))
  cek("tidak mengaku mengisi", r11.ok && r11.skuDiisi === undefined, JSON.stringify(r11))

  console.log("\n12. Kode yang sudah jadi SKU produk lain — dilewati, tautan tetap jalan")
  await tautkanKode(WOO_B, null)
  await updateProduct(WOO_B, { name: "ZZ TEST Produk B", sku: "" })
  // Produk A memegang kode itu sebagai SKU-nya.
  await updateProduct(WOO_A, { name: "ZZ TEST Produk A Diganti", sku: KODE_ACC })
  const r12 = await tautkanKode(WOO_B, KODE_ACC, { isiSku: true })
  cek("penautan TETAP berhasil", r12.ok, r12.ok ? "" : r12.alasan)
  cek("SKU B tidak diisi", (await skuDari(WOO_B)) === null, String(await skuDari(WOO_B)))
  cek("alasannya dilaporkan", r12.ok && typeof r12.skuDilewati === "string", JSON.stringify(r12))
  cek(
    "menyebut produk pemiliknya",
    r12.ok && (r12.skuDilewati ?? "").includes("ZZ TEST Produk A"),
    r12.ok ? String(r12.skuDilewati) : "",
  )
} catch (e) {
  gagal++
  console.log(`\nGALAT TAK TERDUGA: ${e instanceof Error ? e.message : String(e)}`)
} finally {
  await bersihkan()
  const sisa = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM products WHERE name LIKE 'ZZ TEST%'",
  )
  console.log(`\nPembersihan: sisa produk ZZ TEST = ${Number(sisa[0]!.n)}`)
  console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`)
  await prisma.$disconnect()
  process.exit(gagal > 0 ? 1 : 0)
}
