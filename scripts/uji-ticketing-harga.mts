/**
 * Uji endpoint harga untuk Ticketing — docs/17 §23:
 *   GET /api/integrations/ticketing/products/prices?codes=…
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-ticketing-harga.mts
 *
 * Memanggil route ASLI dengan NextRequest. Menulis produk buangan berslug
 * "zztest-harga-…" ke DATABASE_URL — WAJIB DB lokal Docker (docs/16); skrip
 * menolak jalan kalau bukan. Semua dihapus di akhir, sukses maupun gagal.
 */
import { spawnSync } from "node:child_process"

try {
  process.loadEnvFile(".env.local")
} catch {
  // CI
}

const TOKEN = "uji-token-ticketing-0123456789abcdef0123456789abcdef"
const PATH = "/api/integrations/ticketing/products/prices"

// Mode anak: token tidak dipasang → 503.
if (process.argv.includes("--mode=tanpa-token")) {
  process.env.TICKETING_INTEGRATION_TOKEN = ""
  const { NextRequest } = await import("next/server")
  const { GET } = await import("../src/app/api/integrations/ticketing/products/prices/route.ts")
  const res = await GET(new NextRequest(`http://localhost${PATH}?codes=A`, { headers: { authorization: `Bearer ${TOKEN}` } }))
  console.log(JSON.stringify({ status: res.status, body: await res.json() }))
  process.exit(0)
}

const dbHost = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1]
if (dbHost !== "127.0.0.1" && dbHost !== "localhost") {
  console.error(`DITOLAK: DATABASE_URL menunjuk "${dbHost}", bukan database lokal Docker.`)
  process.exit(1)
}

process.env.TICKETING_INTEGRATION_TOKEN = TOKEN

const { NextRequest } = await import("next/server")
const { ProductStatus, ProductType } = await import("@prisma/client")
const route = await import("../src/app/api/integrations/ticketing/products/prices/route.ts")
const { priceCartFromCatalog } = await import("../src/lib/api/woocommerce/cart-pricing.ts")
const { getPrisma } = await import("../src/lib/prisma/client.ts")
const prisma = getPrisma()

let lolos = 0
const gagal: string[] = []
function cek(nama: string, kondisi: boolean, detail = "") {
  if (kondisi) {
    lolos += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${detail ? `  — ${detail}` : ""}`)
  }
}

type Harga = Record<string, unknown>
type Jawaban = { checkedAt?: string; prices?: Record<string, Harga>; error?: string }

async function panggil(query: string | null, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  const url = `http://localhost${PATH}${query === null ? "" : `?codes=${query}`}`
  const res = await route.GET(new NextRequest(url, { headers }))
  const text = await res.text()
  let body: Jawaban = {}
  try {
    body = JSON.parse(text) as Jawaban
  } catch {
    // dibiarkan kosong
  }
  return { status: res.status, body, text, cache: res.headers.get("cache-control") }
}

const SLUG = "zztest-harga-"
const WOO_DASAR = 2_000_000_100
const K = {
  diskon: "ZZTEST-H-01",
  kedaluwarsa: "ZZTEST-H-02",
  draft: "ZZTEST-H-03",
  tanpaHarga: "ZZTEST-H-04",
  induk: "ZZTEST-H-05",
  varian: "ZZTEST-H-06",
  varianIndukDraft: "ZZTEST-H-07",
  biasa: "ZZTEST-H-08",
  tidakTertaut: "ZZTEST-H-99",
}

async function bersihkan() {
  // Varian dulu — induk onDelete: SetNull, tapi urutan ini tidak meninggalkan apa pun.
  await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG }, type: ProductType.VARIATION } })
  await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG } } })
}

const DAY = 86_400_000
let n = 0
async function buat(data: {
  code: string | null
  name: string
  type?: (typeof ProductType)[keyof typeof ProductType]
  status?: (typeof ProductStatus)[keyof typeof ProductStatus]
  regular?: string | null
  sale?: string | null
  saleEnd?: Date | null
  parentId?: number
  sku?: string
}) {
  n += 1
  return prisma.product.create({
    data: {
      wooId: WOO_DASAR + n,
      type: data.type ?? ProductType.SIMPLE,
      status: data.status ?? ProductStatus.PUBLISHED,
      accurateCode: data.code,
      name: data.name,
      slug: `${SLUG}${n}`,
      sku: data.sku,
      regularPrice: data.regular === undefined ? "150000.00" : data.regular,
      salePrice: data.sale ?? null,
      saleEndDate: data.saleEnd ?? null,
      parentId: data.parentId,
      stockQty: 7,
    },
    select: { id: true, slug: true },
  })
}

try {
  await bersihkan()
  const bentrok = await prisma.product.count({ where: { wooId: { gt: WOO_DASAR, lte: WOO_DASAR + 20 } } })
  if (bentrok) throw new Error(`wooId ${WOO_DASAR + 1}…${WOO_DASAR + 20} sudah terpakai — pilih rentang lain`)

  const pDiskon = await buat({ code: K.diskon, name: "ZZ TEST Kipas &amp; Kontroler", regular: "150000.00", sale: "120000.00" })
  const pKedaluwarsa = await buat({ code: K.kedaluwarsa, name: "ZZ TEST Diskon Lewat", regular: "200000.00", sale: "150000.00", saleEnd: new Date(Date.now() - DAY) })
  await buat({ code: K.draft, name: "ZZ TEST Draft", status: ProductStatus.DRAFT })
  await buat({ code: K.tanpaHarga, name: "ZZ TEST Tanpa Harga", regular: null })
  const induk = await buat({ code: K.induk, name: "ZZ TEST Laptop", type: ProductType.VARIABLE, regular: "9000000.00" })
  const pVarian = await buat({
    code: K.varian,
    name: "ZZ TEST Laptop - Hitam",
    type: ProductType.VARIATION,
    parentId: induk.id,
    sku: "ZZTEST-SKU-HITAM",
    regular: "9500000.00",
    sale: "9250000.00",
    saleEnd: new Date(Date.now() + 3 * DAY),
  })
  const indukDraft = await buat({ code: null, name: "ZZ TEST Laptop Draft", type: ProductType.VARIABLE, status: ProductStatus.DRAFT })
  await buat({ code: K.varianIndukDraft, name: "ZZ TEST Laptop Draft - Putih", type: ProductType.VARIATION, parentId: indukDraft.id, sku: "ZZTEST-SKU-PUTIH" })
  const pBiasa = await buat({ code: K.biasa, name: "ZZ TEST Biasa", regular: "75000.40", sale: "0.00" })

  // -------------------------------------------------------------------------
  console.log("\n1. Autentikasi")
  const anak = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, "--mode=tanpa-token"], { encoding: "utf8", env: process.env })
  const hasilAnak = (() => {
    try {
      return JSON.parse(anak.stdout.trim().split("\n").pop() ?? "") as { status: number; body: { error?: string } }
    } catch {
      return null
    }
  })()
  cek("env token kosong → 503 not_configured", hasilAnak?.status === 503 && hasilAnak.body.error === "not_configured", anak.stderr.slice(0, 300))
  const tanpaToken = await panggil(K.diskon, {})
  cek("token kosong → 401 unauthorized", tanpaToken.status === 401 && tanpaToken.body.error === "unauthorized")
  cek("token salah → 401", (await panggil(K.diskon, { authorization: "Bearer token-salah" })).status === 401)
  cek("token hampir benar (beda 1 karakter) → 401", (await panggil(K.diskon, { authorization: `Bearer ${TOKEN.slice(0, -1)}x` })).status === 401)
  cek("401 tidak membocorkan harga", !tanpaToken.text.includes("ZZ TEST") && !tanpaToken.text.includes("120000"))
  cek("Bearer benar → 200", (await panggil(K.diskon)).status === 200)
  cek("X-Ticketing-Token benar → 200", (await panggil(K.diskon, { "x-ticketing-token": TOKEN })).status === 200)

  // -------------------------------------------------------------------------
  console.log("\n2. Parameter codes")
  const banyak = (jumlah: number) => Array.from({ length: jumlah }, (_, i) => `ZZTEST-X-${i}`).join(",")
  const lebih = await panggil(banyak(101))
  cek("101 kode → 400 invalid_codes", lebih.status === 400 && lebih.body.error === "invalid_codes")
  cek("tepat 100 kode → 200", (await panggil(banyak(100))).status === 200)
  cek("101 kode tapi dobel jadi 100 unik → 200", (await panggil(`${banyak(100)},ZZTEST-X-0`)).status === 200)
  cek("tanpa parameter codes → 400", (await panggil(null)).status === 400)
  cek("codes kosong → 400", (await panggil("")).status === 400)
  cek("codes cuma koma & spasi → 400", (await panggil(encodeURIComponent(" , ,"))).status === 400)
  cek("kode > 50 karakter → 400", (await panggil("9".repeat(51))).status === 400)
  const rapi = await panggil(encodeURIComponent(`  ${K.diskon} ,,${K.diskon},${K.biasa.toLowerCase()} `))
  cek(
    "trim, kosong dibuang, dobel dihapus, huruf kecil tetap ketemu",
    rapi.status === 200 && Object.keys(rapi.body.prices ?? {}).sort().join(",") === [K.diskon, K.biasa.toLowerCase()].sort().join(","),
    Object.keys(rapi.body.prices ?? {}).join(","),
  )

  // -------------------------------------------------------------------------
  console.log("\n3. Isi jawaban")
  const semua = await panggil(Object.values(K).join(","))
  const p = semua.body.prices ?? {}
  cek("Cache-Control: no-store", semua.cache === "no-store")
  cek("checkedAt ISO", typeof semua.body.checkedAt === "string" && !Number.isNaN(Date.parse(semua.body.checkedAt)))
  cek("kunci atas persis {checkedAt, prices}", Object.keys(semua.body).sort().join(",") === "checkedAt,prices")
  cek(
    "hanya kode yang sah yang dijawab",
    Object.keys(p).sort().join(",") === [K.diskon, K.kedaluwarsa, K.varian, K.biasa].sort().join(","),
    Object.keys(p).join(","),
  )

  const d = p[K.diskon] ?? {}
  const kunciHarga = "name,onSale,price,productId,regularPrice,saleEndsAt,salePrice,url"
  cek("kunci per harga persis sesuai kontrak", Object.keys(d).sort().join(",") === kunciHarga, Object.keys(d).sort().join(","))
  cek("diskon berlaku: price = salePrice, onSale true", d.price === 120000 && d.salePrice === 120000 && d.regularPrice === 150000 && d.onSale === true && d.saleEndsAt === null)
  cek("productId = id internal", d.productId === pDiskon.id)
  cek("nama ter-decode (&amp; → &)", d.name === "ZZ TEST Kipas & Kontroler", String(d.name))
  cek("url /product/<slug>", typeof d.url === "string" && (d.url as string).endsWith(`/product/${pDiskon.slug}`) && /^https?:\/\//.test(d.url as string), String(d.url))

  const kd = p[K.kedaluwarsa] ?? {}
  cek(
    "diskon kedaluwarsa → harga normal, salePrice null, onSale false",
    kd.price === 200000 && kd.regularPrice === 200000 && kd.salePrice === null && kd.onSale === false && kd.saleEndsAt === null,
    JSON.stringify(kd),
  )

  const v = p[K.varian] ?? {}
  cek("varian dijawab dengan harganya sendiri", v.productId === pVarian.id && v.price === 9250000 && v.regularPrice === 9500000 && v.onSale === true)
  cek("varian: saleEndsAt ISO", typeof v.saleEndsAt === "string" && !Number.isNaN(Date.parse(v.saleEndsAt as string)))
  cek("varian: url halaman induk + ?sku=", typeof v.url === "string" && (v.url as string).endsWith(`/product/${induk.slug}?sku=ZZTEST-SKU-HITAM`), String(v.url))
  cek("varian: nama lengkap", v.name === "ZZ TEST Laptop - Hitam")

  const bs = p[K.biasa] ?? {}
  cek("salePrice 0 bukan diskon; harga dibulatkan ke rupiah", bs.price === 75000 && bs.regularPrice === 75000 && bs.salePrice === null && bs.onSale === false, JSON.stringify(bs))

  cek("kode tidak tertaut → tidak muncul", !(K.tidakTertaut in p))
  cek("produk DRAFT → tidak muncul", !(K.draft in p))
  cek("produk tanpa harga → tidak muncul", !(K.tanpaHarga in p))
  cek("induk bervarian (VARIABLE) → tidak muncul", !(K.induk in p))
  cek("varian dengan induk DRAFT → tidak muncul", !(K.varianIndukDraft in p))

  // -------------------------------------------------------------------------
  console.log("\n4. Sama dengan keranjang")
  const keranjang = await priceCartFromCatalog(
    [pDiskon, pKedaluwarsa, pVarian].map((x) => ({ productId: x.id, quantity: 1 })),
    "id",
  )
  const perId = new Map(keranjang.lines.map((l) => [l.productId, l.unitPrice]))
  cek("diskon berlaku: harga tiket = harga keranjang", perId.get(pDiskon.id) === d.price)
  cek("diskon kedaluwarsa: harga tiket = harga keranjang", perId.get(pKedaluwarsa.id) === kd.price)
  cek("varian: harga tiket = harga keranjang", perId.get(pVarian.id) === v.price)
  void pBiasa

  // -------------------------------------------------------------------------
  console.log("\n5. Yang TIDAK BOLEH ikut")
  for (const terlarang of ["stock", "Stock", "stok", "qty", "cp", "modal", "accurate_products", "customer", "phone", "wooId", "sku\""]) {
    cek(`tidak ada "${terlarang}"`, !semua.text.includes(terlarang))
  }
} finally {
  await bersihkan()
  const sisa = await prisma.product.count({ where: { slug: { startsWith: SLUG } } })
  console.log(`\nBersih-bersih: ${sisa === 0 ? "produk ZZ TEST terhapus" : `MASIH ADA ${sisa} baris`}`)
  await prisma.$disconnect().catch(() => {})
}

console.log(`\n${lolos} lolos, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log(`  - ${g}`)
  process.exit(1)
}
process.exit(0)
