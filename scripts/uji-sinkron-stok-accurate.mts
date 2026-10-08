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
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const S = await import("../src/lib/api/accurate/stock-sync")
const { fetchAllHnsItems } = await import("../src/lib/api/hns-data/client")

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}
const prisma = getPrisma()

// Kolom HPP TIDAK boleh ada di tabel products.
const kolom = await prisma.$queryRaw<{ Field: string }[]>`SHOW COLUMNS FROM products`
cek("products tidak punya kolom HPP/cost", kolom.some((k) => /cost|hpp|modal/i.test(k.Field)), false)

const t0 = Date.now()
const { items, lastSyncAt } = await fetchAllHnsItems()
console.log(`INFO   ${items.length} barang ditarik dari API dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk`)

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

// Satu produk berstok: stok web = jumlah 7 gudang, status Tersedia, bertanda sinkron.
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

// Aturan prioritas: tertaut, stok 0, belum pernah disinkron → TIDAK disentuh.
if (nolBelumSinkron.length > 0) {
  const sesudah = await prisma.product.findMany({
    where: { id: { in: nolBelumSinkron.map((p) => p.id) } },
    select: { id: true, stockQty: true, stockStatus: true, stockSyncedAt: true },
  })
  cek(
    `stok 0 belum pernah sinkron dibiarkan (${sesudah.length} produk)`,
    sesudah.every((p) => {
      const lama = nolBelumSinkron.find((x) => x.id === p.id)!
      return p.stockSyncedAt === null && p.stockQty === lama.stockQty && p.stockStatus === lama.stockStatus
    }),
    true,
  )
}
cek("jumlah dilewati (stok 0) tercatat", r1.productsSkippedZero >= nolBelumSinkron.length, true)

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

// Induk varian (tanpa kode sendiri) selaras dengan variannya.
const induk = await prisma.product.findMany({
  where: { accurateCode: null, variations: { some: { stockSyncedAt: { not: null } } } },
  select: { stockStatus: true, variations: { select: { stockStatus: true } } },
})
cek(
  `status induk varian selaras (${induk.length} induk)`,
  induk.every((i) => (i.stockStatus === "INSTOCK") === i.variations.some((v) => v.stockStatus === "INSTOCK")),
  true,
)

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
