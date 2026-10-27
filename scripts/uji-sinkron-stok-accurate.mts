/**
 * Verifikasi sinkron stok & HPP Accurate (docs/13 §10).
 *
 * MEMBACA API Data Accurate yang sungguhan (butuh HNS_API_URL/HNS_API_TOKEN di
 * .env.local) dan MENULIS ke database — HANYA database lokal; skrip menolak jalan
 * kalau DATABASE_URL bukan 127.0.0.1/localhost. Stok produk lokal yang tertaut
 * dibiarkan dalam keadaan tersinkron sesudahnya (memang itu keadaan yang benar).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-sinkron-stok-accurate.mts
 */
import { config } from "dotenv"
import type { HnsItem } from "../src/lib/api/hns-data/client"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const S = await import("../src/lib/api/accurate/stock-sync")
const { fetchAllHnsItems, buangStokGriya, GUDANG_GRIYA } = await import("../src/lib/api/hns-data/client")

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}
const prisma = getPrisma()

// buangStokGriya dengan barang buatan — aturannya sendiri, lepas dari isi API hari ini.
const buatan: HnsItem = {
  id: 1, sku: "ZZ-TEST", name: "ZZ TEST", barcode: null, type: "INVENTORY", typeName: null, unit: null,
  category: null, brand: null, status: "active", manageSerialNumber: false, accurateUpdatedAt: null, changedAt: null,
  stock: {
    total: 10,
    availableToSell: 9,
    warehouses: [
      { id: 50, name: "GUDANG UTAMA", quantity: 4, countsInTotal: true },
      { id: GUDANG_GRIYA, name: "GRIYA", quantity: 6, countsInTotal: true },
    ],
  },
}
const dibersihkan = buangStokGriya(buatan)
cek("buangStokGriya: baris GRIYA dibuang", dibersihkan.stock!.warehouses.map((w) => w.id), [50])
cek("buangStokGriya: total dikurangi stok GRIYA", dibersihkan.stock!.total, 4)
cek("buangStokGriya: availableToSell dikosongkan", dibersihkan.stock!.availableToSell, null)
const griyaDiLuarTotal = buangStokGriya({
  ...buatan,
  stock: { ...buatan.stock!, warehouses: [{ ...buatan.stock!.warehouses[1], countsInTotal: false }] },
})
cek("buangStokGriya: GRIYA di luar total tidak mengurangi total", griyaDiLuarTotal.stock!.total, 10)
const tanpaGriya: HnsItem = { ...buatan, stock: { ...buatan.stock!, warehouses: [buatan.stock!.warehouses[0]] } }
cek("buangStokGriya: barang tanpa GRIYA dikembalikan apa adanya", buangStokGriya(tanpaGriya) === tanpaGriya, true)

// Kolom HPP TIDAK boleh ada di tabel products.
const kolom = await prisma.$queryRaw<{ Field: string }[]>`SHOW COLUMNS FROM products`
cek("products tidak punya kolom HPP/cost", kolom.some((k) => /cost|hpp|modal/i.test(k.Field)), false)

const t0 = Date.now()
const { items, lastSyncAt } = await fetchAllHnsItems()
console.log(`INFO   ${items.length} barang ditarik dari API dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`)

// GRIYA (id 350) tidak boleh sampai ke aplikasi sama sekali (docs/13 §10, 26 Okt 2026).
cek("tarikan API tanpa baris GRIYA", items.some((i) => (i.stock?.warehouses ?? []).some((w) => w.id === GUDANG_GRIYA)), false)
const hitungSalinanGriya = async () => {
  const [row] = await prisma.$queryRaw<{ n: bigint | number }[]>`
    SELECT COUNT(*) AS n FROM accurate_items
    WHERE JSON_CONTAINS(stock_by_warehouse, JSON_OBJECT('id', ${GUDANG_GRIYA}))`
  return Number(row?.n ?? 0)
}
const salinanGriyaSebelum = await hitungSalinanGriya()
console.log(`INFO   salinan accurate_items bergudang GRIYA sebelum sinkron: ${salinanGriyaSebelum}`)

// Salinan LAMA yang masih memuat GRIYA (disalin sebelum penyaring ada): kartu
// admin tetap tidak boleh menampilkannya.
const [lama] = await prisma.$queryRaw<{ woo_id: number | bigint }[]>`
  SELECT COALESCE(induk.woo_id, p.woo_id) AS woo_id
  FROM accurate_items ai
  JOIN products p ON p.accurate_code = ai.code
  LEFT JOIN products induk ON induk.id = p.parent_id
  WHERE JSON_CONTAINS(ai.stock_by_warehouse, JSON_OBJECT('id', ${GUDANG_GRIYA}))
  LIMIT 1`
if (lama) {
  const info = await S.getAccurateInfoForProduct(Number(lama.woo_id), true)
  cek(
    "salinan lama bergudang GRIYA: kartu admin tidak menampilkannya",
    [info.some((r) => r.info !== null), info.some((r) => (r.info?.warehouses ?? []).some((g) => /griya/i.test(g.name)))],
    [true, false],
  )
} else {
  console.log("INFO   tidak ada salinan lama bergudang GRIYA yang tertaut — cek kartu admin dilewati")
}

// Keadaan SEBELUM: produk tertaut yang belum pernah disinkron dan stok web-nya 0.
const kodeNol = items
  .filter((i) => i.type === "INVENTORY" && Math.floor(S.hitungStokWeb(i)) === 0)
  .map((i) => i.sku.trim())
const nolBelumSinkron = await prisma.product.findMany({
  where: { accurateCode: { in: kodeNol }, stockSyncedAt: null },
  select: { id: true, stockQty: true, stockStatus: true },
  take: 20,
})

const t1 = Date.now()
const r1 = await S.syncAccurateItems(items, { trigger: "manual", userName: "ZZ TEST", sourceSyncedAt: lastSyncAt })
console.log(`INFO   sinkron pertama ${((Date.now() - t1) / 1000).toFixed(1)} dtk:`, JSON.stringify(r1))
cek("sinkron pertama ok", r1.ok && !("duplicate" in r1), true)
if (!r1.ok || "duplicate" in r1) process.exit(1)
cek("ada produk yang diperbarui", r1.productsUpdated > 0, true)
cek("salinan accurate_items = jumlah barang API", await prisma.accurateItem.count(), items.length)
// Sinkron penuh menimpa `stock_by_warehouse` semua barang — inilah yang
// membersihkan salinan lama di produksi tanpa skrip terpisah.
cek("sesudah sinkron penuh: tidak ada salinan bergudang GRIYA", await hitungSalinanGriya(), 0)

// Satu produk berstok: stok web = jumlah gudang web (GUDANG_STOK_WEB), status Tersedia, bertanda sinkron.
const contoh = items.find((i) => i.type === "INVENTORY" && S.hitungStokWeb(i) >= 1 && i.stock!.warehouses.some((w) => !S.GUDANG_STOK_WEB.has(w.id)))
  ?? items.find((i) => i.type === "INVENTORY" && S.hitungStokWeb(i) >= 1)!
const pContoh = await prisma.product.findFirst({ where: { accurateCode: contoh.sku.trim() } })
if (pContoh) {
  cek(`berstok: qty = jumlah gudang web (${contoh.sku})`, pContoh.stockQty, Math.floor(S.hitungStokWeb(contoh)))
  cek("berstok: status INSTOCK & bertanda sinkron", [pContoh.stockStatus, pContoh.stockSyncedAt !== null], ["INSTOCK", true])
} else {
  console.log("INFO   barang contoh tidak tertaut di lokal — cek per-produk dilewati")
}
const gudangLuar = contoh.stock!.warehouses.filter((w) => !S.GUDANG_STOK_WEB.has(w.id))
if (gudangLuar.length > 0) {
  cek("gudang non-web tidak ikut dihitung", S.hitungStokWeb(contoh) < contoh.stock!.warehouses.reduce((a, w) => a + w.quantity, 0), true)
}

// Tertaut, stok 0, belum pernah disinkron → ikut ditulis jadi 0 & Habis (sejak
// 15 Okt 2026; sebelumnya dilewati dan tetap berstatus warisan WooCommerce).
if (nolBelumSinkron.length > 0) {
  const sesudah = await prisma.product.findMany({
    where: { id: { in: nolBelumSinkron.map((p) => p.id) } },
    select: { id: true, stockQty: true, stockStatus: true, stockSyncedAt: true },
  })
  cek(
    `stok 0 belum pernah sinkron jadi 0 & OUTOFSTOCK (${sesudah.length} produk)`,
    sesudah.every((p) => p.stockSyncedAt !== null && p.stockQty === 0 && p.stockStatus === "OUTOFSTOCK"),
    true,
  )
} else {
  console.log("INFO   tidak ada produk tertaut stok 0 yang belum pernah disinkron di lokal — cek aturan stok 0 dilewati")
}
cek("tidak ada yang dilewati (stok 0)", r1.productsSkippedZero, 0)

// Idempoten: sinkron kedua dengan data yang sama tidak mengubah apa pun.
const r2 = await S.syncAccurateItems(items, { trigger: "manual", userName: "ZZ TEST" })
cek("sinkron kedua tidak mengubah apa pun", r2.ok && !("duplicate" in r2) ? r2.productsUpdated : null, 0)

// Produk yang PERNAH disinkron lalu stoknya habis → jadi 0/OUTOFSTOCK.
const pernah = await prisma.product.findFirst({
  where: { stockSyncedAt: { not: null }, stockQty: { gt: 0 }, accurateCode: { not: null } },
  select: { id: true, accurateCode: true },
})
if (pernah) {
  const asli = items.find((i) => i.sku.trim().toUpperCase() === pernah.accurateCode!.trim().toUpperCase())!
  const habis = { ...asli, stock: { ...asli.stock!, total: 0, warehouses: [] } }
  await S.syncAccurateItems([habis], { trigger: "webhook", deliveryId: "zz-test-habis" })
  const p = await prisma.product.findUniqueOrThrow({ where: { id: pernah.id } })
  cek("pernah sinkron lalu habis → 0 & OUTOFSTOCK", [p.stockQty, p.stockStatus], [0, "OUTOFSTOCK"])
  // Kembalikan.
  await S.syncAccurateItems([asli], { trigger: "webhook", deliveryId: "zz-test-pulih" })
  const p2 = await prisma.product.findUniqueOrThrow({ where: { id: pernah.id } })
  cek("dipulihkan oleh kiriman berikutnya", p2.stockStatus, "INSTOCK")

  // Kiriman ganda (deliveryId sama) diabaikan.
  const dup = await S.syncAccurateItems([habis], { trigger: "webhook", deliveryId: "zz-test-pulih" })
  cek("kiriman webhook ganda diabaikan", "duplicate" in dup, true)
  const p3 = await prisma.product.findUniqueOrThrow({ where: { id: pernah.id } })
  cek("kiriman ganda tidak menulis stok", p3.stockStatus, "INSTOCK")
}

// SEMUA induk varian tanpa kode sendiri selaras dengan variannya — termasuk yang
// variasinya tidak berubah di sinkron ini (sejak 16 Okt 2026).
const induk = await prisma.product.findMany({
  where: { type: "VARIABLE", accurateCode: null, variations: { some: {} } },
  select: { stockStatus: true, variations: { select: { stockStatus: true } } },
})
cek(
  `status semua induk varian selaras (${induk.length} induk)`,
  induk.every((i) => i.stockStatus === S.statusIndukDariVariasi(i.variations.map((v) => v.stockStatus))),
  true,
)
cek("aturan induk: ada variasi kosong/tersedia → INSTOCK", S.statusIndukDariVariasi([null, "OUTOFSTOCK"]), "INSTOCK")
cek("aturan induk: hanya pre-order → ONBACKORDER", S.statusIndukDariVariasi(["OUTOFSTOCK", "ONBACKORDER"]), "ONBACKORDER")
cek("aturan induk: semua habis → OUTOFSTOCK", S.statusIndukDariVariasi(["OUTOFSTOCK", "OUTOFSTOCK"]), "OUTOFSTOCK")

// Daftar berstok-belum-tertaut.
const belum = await S.listUnlinkedWithStock({ page: 1 })
cek("daftar belum tertaut terisi & = hitungan run", [belum.total > 0, belum.total], [true, r1.unlinkedWithStock])
cek("daftar urut stok terbanyak", belum.rows.every((r, i, a) => i === 0 || a[i - 1].stockWeb >= r.stockWeb), true)
const tertautKode = new Set((await prisma.product.findMany({ where: { accurateCode: { not: null } }, select: { accurateCode: true } })).map((p) => p.accurateCode!.toUpperCase()))
cek("daftar tidak memuat barang yang sudah tertaut", belum.rows.some((r) => tertautKode.has(r.code.toUpperCase())), false)

// HPP hanya dengan izin.
const pk = await prisma.product.findFirst({ where: { stockSyncedAt: { not: null }, parentId: null, accurateCode: { not: null } }, select: { wooId: true } })
if (pk) {
  const tanpa = await S.getAccurateInfoForProduct(pk.wooId, false)
  const dengan = await S.getAccurateInfoForProduct(pk.wooId, true)
  cek("tanpa izin harga-modal: HPP tidak dikirim", tanpa.every((r) => r.info?.cost === null), true)
  cek("dengan izin harga-modal: HPP terbaca", dengan.some((r) => typeof r.info?.cost === "number"), true)
}

// Bersih: baris run uji.
await prisma.accurateSyncRun.deleteMany({ where: { OR: [{ userName: "ZZ TEST" }, { deliveryId: { startsWith: "zz-test" } }] } })
await prisma.$disconnect()
console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
