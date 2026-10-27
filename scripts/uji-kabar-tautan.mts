/**
 * Verifikasi kabar tautan & harga web ke Data Accurate (docs/13 §11).
 *
 * MENULIS hanya ke database lokal — satu produk buangan "ZZ TEST", dihapus lagi
 * di akhir — dan MENGIRIM hanya ke penerima tiruan di 127.0.0.1 yang dijalankan
 * skrip ini sendiri. Penerima itu memeriksa jalur `/api/v1/web-links` dan
 * `Authorization: Bearer` seperti `withApiClient` di web Data, dan membalas
 * galat dalam bentuk API v1 (`{ error: { code, message } }`).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-kabar-tautan.mts
 */
import crypto from "node:crypto"
import http from "node:http"
import type { AddressInfo } from "node:net"
import { config } from "dotenv"
import type { KeadaanTautan } from "../src/lib/api/hns-data/kabar-tautan"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

// ---------------------------------------------------------------- penerima tiruan

const TOKEN = `hns_${crypto.randomBytes(20).toString("hex")}`
let tokenPenerima = TOKEN
type Kiriman = { event: string; body: Record<string, unknown>; sah: boolean }
const diterima: Kiriman[] = []

const penerima = http.createServer((req, res) => {
  const potong: Buffer[] = []
  req.on("data", (c: Buffer) => potong.push(c))
  req.on("end", () => {
    const balasJson = (status: number, isi: unknown) =>
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(isi))
    if (req.method !== "POST" || req.url !== "/api/v1/web-links") {
      res.writeHead(404, { "Content-Type": "text/html" }).end("<!DOCTYPE html><html>404</html>")
      return
    }
    const sah = req.headers.authorization === `Bearer ${tokenPenerima}`
    diterima.push({ event: String(req.headers["x-hns-event"] ?? ""), body: JSON.parse(Buffer.concat(potong).toString("utf8")), sah })
    if (!sah) balasJson(401, { error: { code: "unauthorized", message: "Token tidak dikenal atau sudah diganti." } })
    else balasJson(200, { ok: true })
  })
})
await new Promise<void>((r) => penerima.listen(0, "127.0.0.1", r))
const port = (penerima.address() as AddressInfo).port
// Sebelum modul aplikasi dimuat — `env` dibaca sekali saat impor.
process.env.HNS_API_URL = `http://127.0.0.1:${port}/api/v1`
process.env.HNS_API_TOKEN = TOKEN
process.env.HNS_WEB_LINKS_ENABLED = "true"

const K = await import("../src/lib/api/hns-data/kabar-tautan")
const P = await import("../src/lib/api/woocommerce/products")
const T = await import("../src/lib/api/accurate/price-table")
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}

/** Kabar `links.changed` pertama untuk `kode` sesudah kiriman ke-`sejak`. */
async function tungguKabar(kode: string, sejak: number, ms = 5000): Promise<(KeadaanTautan & { sah: boolean }) | null> {
  const batas = Date.now() + ms
  while (Date.now() < batas) {
    for (const k of diterima.slice(sejak)) {
      if (k.event !== "links.changed") continue
      const item = (k.body.items as KeadaanTautan[]).find((i) => i.kode.toUpperCase() === kode.toUpperCase())
      if (item) return { ...item, sah: k.sah }
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  return null
}

const DB_LOKAL = "mysql://hns:hns@127.0.0.1:3307/ecommerce_hns"
const DB_PROD = "mysql://u:p@srv1.hstgr.io:3306/u_prod"
const API_PROD = "https://data.hnsitcenter.id/api/v1"
const API_LOKAL = "http://localhost:3001/api/v1/"
cek("penjaga: sakelar mati → tidak mengirim", "alasan" in K.periksaTujuan(false, API_PROD, TOKEN, DB_PROD), true)
cek("penjaga: DB lokal → web Data sungguhan DITOLAK", "alasan" in K.periksaTujuan(true, API_PROD, TOKEN, DB_LOKAL), true)
const lokal = K.periksaTujuan(true, API_LOKAL, TOKEN, DB_LOKAL)
cek("penjaga: DB lokal → web Data localhost boleh, ke /api/v1/web-links",
  "url" in lokal ? lokal.url : lokal.alasan, "http://localhost:3001/api/v1/web-links")
cek("penjaga: DB produksi → web Data sungguhan boleh", "alasan" in K.periksaTujuan(true, API_PROD, TOKEN, DB_PROD), false)
cek("penjaga: tanpa token → tidak mengirim", "alasan" in K.periksaTujuan(true, API_PROD, undefined, DB_PROD), true)

let wooId: number | null = null
let kodeUji: string | null = null
try {
  // Ping & token.
  cek("ping terkirim (2xx)", await K.kirimPing(), { ok: true })
  cek("ping: Bearer token benar & ke /api/v1/web-links", diterima.at(-1)?.sah, true)
  tokenPenerima = "hns_token_lain"
  const tolak = await K.kirimPing()
  cek("token ditolak (401) → pesan API v1 ikut dilaporkan", tolak.ok ? null : tolak.galat,
    "web Data membalas HTTP 401: Token tidak dikenal atau sudah diganti.")
  tokenPenerima = TOKEN

  // Kode uji: barang Accurate aktif yang belum tertaut dan belum ditandai.
  const [calon] = await prisma.$queryRaw<{ code: string }[]>`
    SELECT ai.code FROM accurate_items ai
    LEFT JOIN products p ON p.accurate_code = ai.code
    LEFT JOIN accurate_ignored ig ON ig.kode_accurate = ai.code
    WHERE ai.status = 'active' AND p.id IS NULL AND ig.kode_accurate IS NULL
    ORDER BY ai.code LIMIT 1`
  if (!calon) throw new Error("Tidak ada kode Accurate bebas di database lokal — jalankan uji-sinkron-stok-accurate dulu.")
  kodeUji = calon.code

  const besok = new Date(Date.now() + 86_400_000).toISOString()
  const dibuat = await P.createProduct({
    name: "ZZ TEST kabar tautan",
    type: "simple",
    status: "draft",
    regular_price: "12345",
    sale_price: "10000",
    date_on_sale_to_gmt: besok,
  })
  wooId = Number(dibuat.id)
  const slug = dibuat.slug

  // 1. Tautkan → "tertaut", lengkap dengan harga katalog.
  let n = diterima.length
  cek("tautkanKode berhasil", (await T.tautkanKode(wooId, kodeUji, "ZZ TEST")).ok, true)
  const tertaut = await tungguKabar(kodeUji, n)
  cek("tautkan → kabar tertaut dengan token sah", [tertaut?.status, tertaut?.sah], ["tertaut", true])
  cek("tautkan → id = wooId, simple, tanpa varian, belum tayang (draft)",
    [tertaut?.produk?.id, tertaut?.produk?.jenis, tertaut?.produk?.varian, tertaut?.produk?.tayang],
    [wooId, "simple", null, false])
  cek("tautkan → harga normal & promo yang sedang berlaku",
    [tertaut?.produk?.harga.normal, tertaut?.produk?.harga.promo, typeof tertaut?.produk?.harga.promoBerakhir],
    [12345, 10000, "string"])
  cek("tautkan → url halaman & url admin",
    [tertaut?.produk?.url.endsWith(`/product/${slug}`), tertaut?.produk?.adminUrl.endsWith(`/admin/produk/${wooId}`)],
    [true, true])

  // 2. Harga berubah lewat updateProduct → kabar membawa harga baru.
  n = diterima.length
  await P.updateProduct(wooId, { name: "ZZ TEST kabar tautan", regular_price: "20000", sale_price: "" })
  const hargaBaru = await tungguKabar(kodeUji, n)
  cek("ubah harga → kabar harga normal baru, promo hilang",
    [hargaBaru?.produk?.harga.normal, hargaBaru?.produk?.harga.promo, hargaBaru?.produk?.harga.promoBerakhir],
    [20000, null, null])

  // 3. Promo yang sudah lewat tanggalnya TIDAK dikirim sebagai promo.
  n = diterima.length
  const kemarin = new Date(Date.now() - 86_400_000).toISOString()
  await P.updateProduct(wooId, { name: "ZZ TEST kabar tautan", sale_price: "9000", date_on_sale_to_gmt: kemarin })
  const promoLewat = await tungguKabar(kodeUji, n)
  cek("promo lewat tanggal → promo null, normal tetap",
    [promoLewat?.produk?.harga.normal, promoLewat?.produk?.harga.promo], [20000, null])

  // 4. Lepas → "belum"; tandai → "diabaikan"; batalkan → "belum".
  n = diterima.length
  await T.tautkanKode(wooId, null, "ZZ TEST")
  const lepas = await tungguKabar(kodeUji, n)
  cek("lepas tautan → belum, tanpa produk", [lepas?.status, lepas?.produk], ["belum", null])
  n = diterima.length
  cek("abaikanKode berhasil", (await T.abaikanKode(kodeUji, null, "ZZ TEST")).ok, true)
  cek("tandai tidak dijual di web → diabaikan", (await tungguKabar(kodeUji, n))?.status, "diabaikan")
  n = diterima.length
  await T.batalkanAbaikan(kodeUji)
  cek("batalkan tanda → belum", (await tungguKabar(kodeUji, n))?.status, "belum")

  // 5. Hapus produk tertaut → "belum" (kodenya diambil sebelum dihapus).
  n = diterima.length
  await T.tautkanKode(wooId, kodeUji, "ZZ TEST")
  cek("tautkan ulang → tertaut", (await tungguKabar(kodeUji, n))?.status, "tertaut")
  n = diterima.length
  await P.deleteProduct(wooId)
  wooId = null
  cek("hapus produk tertaut → belum", (await tungguKabar(kodeUji, n))?.status, "belum")

  // 6. Varian: id induk + id varian, URL memilihkan varian lewat ?sku=.
  const v = await prisma.product.findFirst({
    where: { type: "VARIATION", accurateCode: { not: null }, parentId: { not: null }, sku: { not: null } },
    select: { accurateCode: true, wooId: true, sku: true, parent: { select: { wooId: true } } },
  })
  if (v?.accurateCode && v.parent) {
    n = diterima.length
    cek("kirim keadaan varian", await K.kirimKeadaan([v.accurateCode]), { ok: true })
    const varian = await tungguKabar(v.accurateCode, n)
    cek("varian → jenis variable, id induk, id varian",
      [varian?.produk?.jenis, varian?.produk?.id, varian?.produk?.varian?.id], ["variable", v.parent.wooId, v.wooId])
    cek("varian → url memuat ?sku=", varian?.produk?.url.includes(`?sku=${encodeURIComponent(v.sku!)}`), true)
  } else {
    console.log("INFO   tidak ada varian tertaut ber-SKU di lokal — cek varian dilewati")
  }

  // 7. Penggabungan: dua panggilan beruntun = SATU kiriman.
  n = diterima.length
  K.kabariWebData(["ZZ-TEST-A"])
  K.kabariWebData(["ZZ-TEST-B"])
  await tungguKabar("ZZ-TEST-B", n)
  const gabungan = diterima.slice(n).filter((k) => k.event === "links.changed")
  cek("dua kabar beruntun digabung jadi satu kiriman",
    [gabungan.length, (gabungan[0]?.body.items as KeadaanTautan[] | undefined)?.map((i) => i.kode)],
    [1, ["ZZ-TEST-A", "ZZ-TEST-B"]])

  // 8. Salinan utuh.
  n = diterima.length
  const salinan = await K.kirimSalinanTautan()
  const bagian = diterima.slice(n).filter((k) => k.event === "links.snapshot")
  const tertautDb = await prisma.product.findMany({ where: { accurateCode: { not: null } }, select: { accurateCode: true } })
  const ditandaiDb = await prisma.accurateIgnored.findMany({ select: { kodeAccurate: true } })
  const kodeTertaut = new Set(tertautDb.map((p) => p.accurateCode!.trim().toUpperCase()))
  const harapDiabaikan = new Set(ditandaiDb.map((d) => d.kodeAccurate.trim().toUpperCase()).filter((k) => !kodeTertaut.has(k)))
  const semua = bagian.flatMap((b) => b.body.items as KeadaanTautan[])
  cek("salinan terkirim", salinan.ok, true)
  cek("salinan: semua bagian sah, satu snapshotId, bernomor urut",
    [bagian.every((b) => b.sah), new Set(bagian.map((b) => b.body.snapshotId)).size,
     bagian.map((b) => b.body.part), bagian.every((b) => b.body.totalParts === bagian.length)],
    [true, 1, bagian.map((_, i) => i + 1), true])
  const readAt = bagian[0]?.body.readAt
  cek("salinan: satu readAt untuk semua bagian, sebelum bagian pertama dikirim",
    [new Set(bagian.map((b) => b.body.readAt)).size, typeof readAt === "string" && readAt <= String(bagian[0]?.body.sentAt)],
    [1, true])
  const changedTerakhir = diterima.filter((k) => k.event === "links.changed").at(-1)
  cek("links.changed membawa readAt", typeof changedTerakhir?.body.readAt, "string")
  cek(`salinan: ${kodeTertaut.size} tertaut + ${harapDiabaikan.size} diabaikan, tanpa kembar`,
    [semua.filter((i) => i.status === "tertaut").length, semua.filter((i) => i.status === "diabaikan").length,
     new Set(semua.map((i) => i.kode.toUpperCase())).size === semua.length],
    [kodeTertaut.size, harapDiabaikan.size, true])
  cek("salinan: tidak memuat kode uji yang sudah dilepas", semua.some((i) => i.kode === kodeUji), false)
} finally {
  if (wooId !== null) await P.deleteProduct(wooId).catch(() => {})
  if (kodeUji) await prisma.accurateIgnored.deleteMany({ where: { kodeAccurate: kodeUji } })
  await prisma.productLog.deleteMany({ where: { userName: "ZZ TEST", fieldAffected: "accurate_code" } })
  await new Promise((r) => setTimeout(r, 300)) // kabar terakhir yang masih di jalan
  penerima.close()
  await prisma.$disconnect()
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
