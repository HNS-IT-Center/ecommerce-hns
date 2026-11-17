/**
 * Uji endpoint Ticketing — docs/17 §20:
 *   GET /api/integrations/ticketing/pc-build-quotes/{code}
 *   GET /api/integrations/ticketing/pc-build-quotes/by-token/{token}
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-ticketing-quote.mts
 *
 * Memanggil route ASLI dengan NextRequest. Menulis satu quotation buangan
 * "ZZTEST-…" ke DATABASE_URL — WAJIB DB lokal Docker (docs/16); skrip menolak
 * jalan kalau bukan. Juga dua akun buangan "zztest-ticketing-*@example.test"
 * (staff & pelanggan) sebagai pemilik. Semua dihapus di akhir, sukses maupun gagal.
 */
import { spawnSync } from "node:child_process"

try {
  process.loadEnvFile(".env.local")
} catch {
  // CI
}

const TOKEN = "uji-token-ticketing-0123456789abcdef0123456789abcdef"

// Mode anak: token tidak dipasang → 503.
if (process.argv.includes("--mode=tanpa-token")) {
  process.env.TICKETING_INTEGRATION_TOKEN = ""
  const { NextRequest } = await import("next/server")
  const { GET } = await import("../src/app/api/integrations/ticketing/pc-build-quotes/[code]/route.ts")
  const res = await GET(
    new NextRequest("http://localhost/api/integrations/ticketing/pc-build-quotes/HNSPC-1", {
      headers: { authorization: `Bearer ${TOKEN}` },
    }),
    { params: Promise.resolve({ code: "HNSPC-1" }) },
  )
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
const route = await import("../src/app/api/integrations/ticketing/pc-build-quotes/[code]/route.ts")
const routeToken = await import("../src/app/api/integrations/ticketing/pc-build-quotes/by-token/[token]/route.ts")
const { normalizeTicketingQuoteCode, normalizeTicketingPublicToken } = await import("../src/lib/api/ticketing-quotes.ts")
const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { parsePcBuilderSteps, PC_BUILDER_SETTING_KEY } = await import("../src/lib/pc-builder/config.ts")
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

async function panggil(code: string, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  const res = await route.GET(
    new NextRequest(`http://localhost/api/integrations/ticketing/pc-build-quotes/${encodeURIComponent(code)}`, { headers }),
    { params: Promise.resolve({ code: encodeURIComponent(code) }) },
  )
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body, text, cache: res.headers.get("cache-control") }
}

async function panggilToken(token: string, headers: Record<string, string> = { authorization: `Bearer ${TOKEN}` }) {
  const res = await routeToken.GET(
    new NextRequest(`http://localhost/api/integrations/ticketing/pc-build-quotes/by-token/${encodeURIComponent(token)}`, { headers }),
    { params: Promise.resolve({ token: encodeURIComponent(token) }) },
  )
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: res.status, body, text, cache: res.headers.get("cache-control") }
}

const KODE = "ZZTEST-TICKETING-0001"
const KODE_PELANGGAN = "ZZTEST-TICKETING-0002"
const KODE_TANPA_PEMILIK = "ZZTEST-TICKETING-0003"
// Alfabet token publik tanpa 0/1/o/l/i (lib/utils/public-token.ts).
const TOKEN_PUBLIK = "zzujxa7k"
const EMAIL_STAFF = "zztest-ticketing-staff@example.test"
const EMAIL_PELANGGAN = "zztest-ticketing-pelanggan@example.test"
const SUB_STAFF = "zztest-sso-sub-staff-0001"
const CATATAN_RAHASIA = "RAHASIA-ZZ-CATATAN-INTERNAL"
const HASH_RAHASIA = "zz".repeat(32)
const PRODUK_DIHAPUS = 2_000_000_001

async function bersihkan() {
  await prisma.pcBuildQuote.deleteMany({ where: { code: { in: [KODE, KODE_PELANGGAN, KODE_TANPA_PEMILIK] } } })
  await prisma.user.deleteMany({ where: { email: { in: [EMAIL_STAFF, EMAIL_PELANGGAN] } } })
}

// Pengaturan builder dipinjam sebentar untuk menguji stepKind, lalu DIPULIHKAN
// persis (termasuk kalau barisnya memang belum ada).
const settingAsli = await prisma.setting.findUnique({ where: { key: PC_BUILDER_SETTING_KEY } })

try {
  await bersihkan()
  const stepsAsli = Array.isArray(settingAsli?.value) ? (settingAsli.value as Record<string, unknown>[]) : []
  const stepsUji = [
    ...stepsAsli.filter((st) => !["motherboard", "zz uji bentrok"].includes(String(st.name).trim().toLowerCase())),
    { id: "zz-mobo", name: "  MOTHERBOARD ", order: 900, categoryIds: [], dependSteps: [], dependAttributes: [], kind: "component" },
    { id: "zz-b1", name: "ZZ Uji Bentrok", order: 901, categoryIds: [], dependSteps: [], dependAttributes: [], kind: "component" },
    { id: "zz-b2", name: "zz uji bentrok", order: 902, categoryIds: [], dependSteps: [], dependAttributes: [], kind: "service" },
    { id: "zz-asing", name: "Storage", order: 903, categoryIds: [], dependSteps: [], dependAttributes: [], kind: "bukan-jenis" },
  ]
  await prisma.setting.upsert({
    where: { key: PC_BUILDER_SETTING_KEY },
    update: { value: stepsUji },
    create: { key: PC_BUILDER_SETTING_KEY, value: stepsUji },
  })

  // Produk lokal yang punya Kode Accurate — untuk membuktikan accurateCode dibaca dari katalog.
  const produk = await prisma.product.findFirst({
    where: { accurateCode: { not: null } },
    select: { id: true, name: true, sku: true, accurateCode: true },
  })
  if (!produk) throw new Error("DB lokal tidak punya produk ber-Kode Accurate untuk diuji")
  const takAda = await prisma.product.findUnique({ where: { id: PRODUK_DIHAPUS } })
  if (takAda) throw new Error(`id ${PRODUK_DIHAPUS} ternyata ada — pilih id lain untuk "produk dihapus"`)

  const items = [
    { productId: produk.id, name: produk.name, sku: "SKU-DI-SNAPSHOT", price: 1250000, quantity: 2, stepName: "Storage", variationLabel: "1TB · Hitam", parentName: "SSD UJI" },
    { productId: PRODUK_DIHAPUS, name: "MOTHERBOARD SUDAH DIHAPUS", sku: null, price: 2500000, quantity: 1, stepName: "Motherboard" },
    { productId: PRODUK_DIHAPUS, name: "BARIS STEP BENTROK", sku: null, price: 0, quantity: 1, stepName: "ZZ Uji Bentrok" },
  ]
  const staff = await prisma.user.create({
    data: { email: EMAIL_STAFF, name: "ZZ TEST Sales", role: "staff", ssoSub: SUB_STAFF },
    select: { id: true },
  })
  const pelanggan = await prisma.user.create({
    data: { email: EMAIL_PELANGGAN, name: "ZZ TEST Mantan Staff", role: "pelanggan" },
    select: { id: true },
  })
  const dasar = {
    contentHash: HASH_RAHASIA,
    items,
    subtotal: "5000000.00",
    assemblyFee: "0.00",
    total: "5000000.00",
    itemCount: 3,
  }
  await prisma.pcBuildQuote.create({ data: { ...dasar, code: KODE_PELANGGAN, ownerUserId: pelanggan.id } })
  await prisma.pcBuildQuote.create({ data: { ...dasar, code: KODE_TANPA_PEMILIK } })

  const created = await prisma.pcBuildQuote.create({
    data: {
      code: KODE,
      ownerUserId: staff.id,
      createdByUserId: staff.id,
      contentHash: HASH_RAHASIA,
      customerName: "ZZ TEST Pelanggan",
      customerPhone: "081200000000",
      internalNote: CATATAN_RAHASIA,
      salesName: "ZZ Sales",
      items,
      subtotal: "5000000.00",
      assemblyFee: "250000.00",
      discount: "0.00",
      total: "5250000.00",
      itemCount: 3,
      revision: 2,
      status: "terbit",
      publicToken: TOKEN_PUBLIK,
      dpAt: new Date("2026-11-10T03:00:00Z"),
      revisions: {
        create: [
          { revision: 1, items, subtotal: "5000000.00", assemblyFee: "250000.00", total: "5250000.00", itemCount: 3, createdAt: new Date("2026-11-01T03:00:00Z") },
          { revision: 2, items, subtotal: "5000000.00", assemblyFee: "250000.00", total: "5250000.00", itemCount: 3, createdAt: new Date("2026-11-05T03:00:00Z") },
        ],
      },
    },
    select: { updatedAt: true },
  })

  // -------------------------------------------------------------------------
  console.log("\n1. Autentikasi")
  const anak = spawnSync(process.execPath, [...process.execArgv, process.argv[1]!, "--mode=tanpa-token"], {
    encoding: "utf8",
    env: process.env,
  })
  const hasilAnak = (() => {
    try {
      return JSON.parse(anak.stdout.trim().split("\n").pop() ?? "") as { status: number; body: { error?: string } }
    } catch {
      return null
    }
  })()
  cek("env token kosong → 503 not_configured", hasilAnak?.status === 503 && hasilAnak.body.error === "not_configured", anak.stderr.slice(0, 300))

  const tanpaHeader = await panggil(KODE, {})
  cek("tanpa token → 401 unauthorized", tanpaHeader.status === 401 && (tanpaHeader.body as { error?: string }).error === "unauthorized")
  cek("token salah → 401", (await panggil(KODE, { authorization: "Bearer token-salah" })).status === 401)
  cek("token hampir benar (beda 1 karakter) → 401", (await panggil(KODE, { authorization: `Bearer ${TOKEN.slice(0, -1)}x` })).status === 401)
  cek("skema bukan Bearer → 401", (await panggil(KODE, { authorization: `Basic ${TOKEN}` })).status === 401)
  cek("Authorization: Bearer benar → 200", (await panggil(KODE)).status === 200)
  cek("header cadangan X-Ticketing-Token benar → 200", (await panggil(KODE, { "x-ticketing-token": TOKEN })).status === 200)
  cek("401 tidak membocorkan isi quotation", !tanpaHeader.text.includes("ZZ TEST"))

  // -------------------------------------------------------------------------
  console.log("\n2. Kode")
  cek("kode kosong (spasi) → 400 invalid_code", (await panggil("   ")).status === 400)
  cek("kode terlalu pendek → 400", (await panggil("AB")).status === 400)
  cek("karakter asing → 400 (bukan dibuang diam-diam)", (await panggil("HNSPC-2026<script>")).status === 400)
  cek("lebih dari 32 karakter → 400", (await panggil("H".repeat(33))).status === 400)
  const tidakAda = await panggil("HNSPC-29991231-9999")
  cek("kode wajar tapi tidak ada → 404 not_found", tidakAda.status === 404 && (tidakAda.body as { error?: string }).error === "not_found")
  cek("huruf kecil + spasi tepi dirapikan → tetap ketemu", (await panggil(`  ${KODE.toLowerCase()} `)).status === 200)
  cek("format lama HNSPC-260804-7K3M lolos validasi", normalizeTicketingQuoteCode("hnspc-260804-7k3m") === "HNSPC-260804-7K3M")
  cek("format baru 5 digit urut lolos validasi", normalizeTicketingQuoteCode("HNSPC-20260921-10001") === "HNSPC-20260921-10001")

  // -------------------------------------------------------------------------
  console.log("\n3. Bentuk respons 200")
  const ok = await panggil(KODE)
  const b = ok.body as Record<string, unknown>
  const kunciAtas = Object.keys(b).sort().join(",")
  const kunciDiharapkan = [
    "code", "kind", "prebuildName", "revision", "status", "dpAt", "closedAt", "customer", "salesName", "sales", "items",
    "subtotal", "assemblyFee", "discount", "total", "publicUrl", "createdAt", "pricedAt", "updatedAt",
  ].sort().join(",")
  cek("kunci tingkat atas persis sesuai kontrak", kunciAtas === kunciDiharapkan, kunciAtas)
  cek("Cache-Control: no-store", ok.cache === "no-store")
  cek("code, kind, revision, status", b.code === KODE && b.kind === "build" && b.revision === 2 && b.status === "terbit")
  cek("prebuildName null untuk kind build", b.prebuildName === null)
  cek("dpAt ISO, closedAt null", b.dpAt === "2026-11-10T03:00:00.000Z" && b.closedAt === null)
  cek("customer {name, phone}", JSON.stringify(b.customer) === JSON.stringify({ name: "ZZ TEST Pelanggan", phone: "081200000000" }))
  cek("salesName", b.salesName === "ZZ Sales")
  cek("sales = {email, ssoSub} pemilik, persis dua kunci", JSON.stringify(b.sales) === JSON.stringify({ email: EMAIL_STAFF, ssoSub: SUB_STAFF }), JSON.stringify(b.sales))
  const milikPelanggan = (await panggil(KODE_PELANGGAN)).body as Record<string, unknown>
  cek("sales null kalau pemiliknya sudah bukan staff (role pelanggan)", milikPelanggan.sales === null, JSON.stringify(milikPelanggan.sales))
  const tanpaPemilik = (await panggil(KODE_TANPA_PEMILIK)).body as Record<string, unknown>
  cek("sales null kalau quotation tanpa pemilik", tanpaPemilik.sales === null && tanpaPemilik.publicUrl === null)
  cek(
    "uang = integer Rupiah (bukan string desimal)",
    b.subtotal === 5000000 && b.assemblyFee === 250000 && b.discount === 0 && b.total === 5250000,
    JSON.stringify([b.subtotal, b.assemblyFee, b.discount, b.total]),
  )
  cek("publicUrl absolut /q/<token>", typeof b.publicUrl === "string" && /^https?:\/\/[^/]+\/q\/zzujxa7k$/.test(b.publicUrl as string), String(b.publicUrl))
  cek("pricedAt = tanggal revisi TERAKHIR", b.pricedAt === "2026-11-05T03:00:00.000Z", String(b.pricedAt))
  cek("createdAt & updatedAt ISO", typeof b.createdAt === "string" && !Number.isNaN(Date.parse(b.updatedAt as string)))

  const its = b.items as Record<string, unknown>[]
  cek("3 baris komponen", Array.isArray(its) && its.length === 3)
  const kunciItem = "accurateCode,name,productId,quantity,sku,stepKind,stepName,unitPrice,variationLabel"
  cek("kunci baris komponen persis sesuai kontrak", its.every((i) => Object.keys(i).sort().join(",") === kunciItem), Object.keys(its[0] ?? {}).sort().join(","))
  cek("productId = id internal (number)", its[0]?.productId === produk.id && typeof its[0]?.productId === "number")
  cek("sku dari SNAPSHOT, bukan katalog", its[0]?.sku === "SKU-DI-SNAPSHOT")
  cek("accurateCode dibaca dari katalog saat ini", its[0]?.accurateCode === produk.accurateCode)
  cek("accurateCode null untuk produk yang sudah dihapus", its[1]?.accurateCode === null && its[1]?.productId === PRODUK_DIHAPUS)
  cek("unitPrice integer", its[0]?.unitPrice === 1250000 && its[1]?.unitPrice === 2500000)
  cek("quantity, stepName, variationLabel", its[0]?.quantity === 2 && its[0]?.stepName === "Storage" && its[0]?.variationLabel === "1TB · Hitam")
  cek("variationLabel null untuk komponen biasa", its[1]?.variationLabel === null)
  cek("stepKind dari pengaturan step (cocok nama, abaikan besar-kecil & spasi)", its[1]?.stepKind === "component", String(its[1]?.stepKind))
  cek("stepKind null kalau jenis step di pengaturan tidak sah", its[0]?.stepKind === null, String(its[0]?.stepKind))
  cek("stepKind null kalau dua step senama berbeda jenis (tidak 'yang pertama menang')", its[2]?.stepKind === null, String(its[2]?.stepKind))
  const tersaring = parsePcBuilderSteps([{ id: "a", name: "A", kind: "bukan-jenis" }, { id: "b", name: "B", kind: "service" }, { name: "tanpa id" }])
  cek("parsePcBuilderSteps buang kind asing (step tetap), buang entri cacat", tersaring.length === 2 && !("kind" in tersaring[0]!) && tersaring[1]?.kind === "service")
  cek("parentName & field snapshot lain tidak ikut", !("parentName" in (its[0] ?? {})) && !("price" in (its[0] ?? {})))

  // -------------------------------------------------------------------------
  console.log("\n3b. Lewat token tautan publik /q/<token>")
  const viaToken = await panggilToken(TOKEN_PUBLIK)
  cek("by-token → 200, isi IDENTIK dengan lewat kode", viaToken.status === 200 && viaToken.text === ok.text)
  cek("by-token Cache-Control: no-store", viaToken.cache === "no-store")
  cek("by-token huruf besar + spasi tepi dirapikan", (await panggilToken(`  ${TOKEN_PUBLIK.toUpperCase()} `)).status === 200)
  cek("by-token tanpa token integrasi → 401", (await panggilToken(TOKEN_PUBLIK, {})).status === 401)
  cek("by-token lewat X-Ticketing-Token → 200", (await panggilToken(TOKEN_PUBLIK, { "x-ticketing-token": TOKEN })).status === 200)
  const tokenAsing = await panggilToken("zzuji001")
  cek("token berkarakter di luar alfabet (0/1) → 400 invalid_token", tokenAsing.status === 400 && (tokenAsing.body as { error?: string }).error === "invalid_token")
  cek("token panjang salah → 400", (await panggilToken("zzujxa7kz")).status === 400)
  cek("KODE quotation di rute by-token → 400 (bukan dicari sebagai token)", (await panggilToken(KODE)).status === 400)
  const tokenTakAda = await panggilToken("zzzzzzzz")
  cek("token sah tapi tidak ada → 404 not_found", tokenTakAda.status === 404 && (tokenTakAda.body as { error?: string }).error === "not_found")
  cek("normalizeTicketingPublicToken", normalizeTicketingPublicToken(" ZZUJXA7K ") === "zzujxa7k" && normalizeTicketingPublicToken("") === null)

  // -------------------------------------------------------------------------
  console.log("\n4. Yang TIDAK BOLEH ikut")
  const teks = JSON.stringify(ok.body)
  for (const terlarang of [
    "internalNote", "internal_note", CATATAN_RAHASIA,
    "contentHash", "content_hash", HASH_RAHASIA,
    "ownerUserId", "owner", "createdByUserId", "createdBy", "closedByUserId", "closedBy", "dpByUserId", "dpBy",
    "handoverSeenAt", "handover", "submissions", "revisions", "publicToken", "period", "sequence",
    staff.id, "ZZ TEST Sales", "roleId", "passwordHash", "googleSub",
  ]) {
    cek(`tidak ada "${terlarang.length > 30 ? terlarang.slice(0, 12) + "…" : terlarang}"`, !teks.includes(terlarang))
  }

  // -------------------------------------------------------------------------
  console.log("\n5. Benar-benar hanya membaca")
  const sesudah = await prisma.pcBuildQuote.findUnique({ where: { code: KODE }, select: { updatedAt: true, revision: true, status: true } })
  cek("updatedAt tidak berubah setelah dipanggil berkali-kali", sesudah?.updatedAt.getTime() === created.updatedAt.getTime())
  cek("revision & status tidak berubah", sesudah?.revision === 2 && sesudah?.status === "terbit")
} finally {
  await bersihkan()
  if (settingAsli) {
    await prisma.setting.update({ where: { key: PC_BUILDER_SETTING_KEY }, data: { value: settingAsli.value ?? [] } })
  } else {
    await prisma.setting.deleteMany({ where: { key: PC_BUILDER_SETTING_KEY } })
  }
  const pulih = await prisma.setting.findUnique({ where: { key: PC_BUILDER_SETTING_KEY } })
  console.log(`Pengaturan builder: ${JSON.stringify(pulih?.value ?? null) === JSON.stringify(settingAsli?.value ?? null) ? "dipulihkan persis" : "TIDAK SAMA dengan semula!"}`)
  const sisa =
    (await prisma.pcBuildQuote.count({ where: { code: { startsWith: "ZZTEST-TICKETING-" } } })) +
    (await prisma.user.count({ where: { email: { in: [EMAIL_STAFF, EMAIL_PELANGGAN] } } }))
  console.log(`\nBersih-bersih: ${sisa === 0 ? "quotation & akun ZZ TEST terhapus" : `MASIH ADA ${sisa} baris`}`)
  await prisma.$disconnect().catch(() => {})
}

console.log(`\n${lolos} lolos, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log(`  - ${g}`)
  process.exit(1)
}
process.exit(0)
