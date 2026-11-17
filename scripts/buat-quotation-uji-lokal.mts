/**
 * Terbitkan SATU quotation format baru (`HNSPC-YYYYMMDD-NNNN`) di database
 * LOKAL — untuk uji integrasi Ticketing (docs/17 §20).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json scripts/buat-quotation-uji-lokal.mts
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json scripts/buat-quotation-uji-lokal.mts --sales=<email-staff>
 *
 * Memanggil `issueQuotation()` ASLI — fungsi yang sama dengan tombol Print di
 * builder — jadi nomor urut, harga katalog, nama step, dan baris Jasa Rakit
 * terbentuk persis seperti quotation sungguhan. Tidak ada angka yang dikarang.
 *
 * Isinya: satu produk dari setiap step Komponen yang punya produk terbit
 * berharga (maksimal 4), ditambah satu baris dari step "Jasa Rakit".
 * Pelanggan "ZZ TEST Pelanggan Ticketing" — quotation ini sengaja TIDAK
 * dihapus, karena memang dibuat untuk dipakai Ticketing.
 *
 * Menolak jalan kalau DATABASE_URL bukan localhost (docs/16).
 */
try {
  process.loadEnvFile(".env.local")
} catch {
  // tanpa .env.local
}

const dbHost = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1]
if (dbHost !== "127.0.0.1" && dbHost !== "localhost") {
  console.error(`DITOLAK: DATABASE_URL menunjuk "${dbHost}", bukan database lokal.`)
  process.exit(1)
}

const salesArg = process.argv.find((a) => a.startsWith("--sales="))?.slice("--sales=".length).trim()

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { issueQuotation } = await import("../src/lib/api/pc-build-quotes.ts")
const { parsePcBuilderSteps, PC_BUILDER_SETTING_KEY } = await import("../src/lib/pc-builder/config.ts")
const prisma = getPrisma()

try {
  // Sales: akun yang disebut, atau akun staff pertama. Pelanggan tidak bisa
  // memiliki quotation bernomor urut (docs/17 §1).
  const sales = await prisma.user.findFirst({
    where: salesArg ? { email: salesArg } : { role: { not: "pelanggan" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, salesDisplayName: true, role: true },
  })
  if (!sales) throw new Error(salesArg ? `Akun "${salesArg}" tidak ditemukan.` : "Tidak ada akun staff di DB lokal.")
  if (sales.role === "pelanggan") throw new Error(`Akun "${sales.email}" ber-role pelanggan, bukan staff.`)

  const setting = await prisma.setting.findUnique({ where: { key: PC_BUILDER_SETTING_KEY } })
  const steps = parsePcBuilderSteps(setting?.value ?? null).sort((a, b) => a.order - b.order)
  if (steps.length === 0) throw new Error("PC_BUILDER_CONFIG kosong di DB lokal.")

  const isJasa = (name: string) => /jasa\s*rakit/i.test(name)
  const jasaStep = steps.find((s) => isJasa(s.name))
  const componentSteps = steps.filter((s) => !isJasa(s.name) && (s.kind === undefined || s.kind === "component"))

  async function pickProduct(categoryIds: number[]) {
    if (categoryIds.length === 0) return null
    return prisma.product.findFirst({
      where: {
        status: "PUBLISHED",
        type: { in: ["SIMPLE", "VARIATION"] },
        regularPrice: { gt: 0 },
        categories: { some: { categoryId: { in: categoryIds } } },
      },
      orderBy: { id: "asc" },
      select: { id: true, name: true },
    })
  }

  const selections: { stepId: string; productId: number; quantity: number }[] = []
  for (const step of componentSteps) {
    if (selections.length >= 4) break
    const product = await pickProduct(step.categoryIds)
    if (product) selections.push({ stepId: step.id, productId: product.id, quantity: 1 })
  }
  if (selections.length === 0) throw new Error("Tidak ada produk komponen terbit berharga di DB lokal.")

  if (!jasaStep) {
    console.warn('PERINGATAN: step "Jasa Rakit" tidak ada di pengaturan builder lokal — quotation terbit tanpanya.')
  } else {
    const jasa = await pickProduct(jasaStep.categoryIds)
    if (jasa) selections.push({ stepId: jasaStep.id, productId: jasa.id, quantity: 1 })
    else console.warn('PERINGATAN: step "Jasa Rakit" tidak punya produk terbit berharga — quotation terbit tanpanya.')
  }

  const result = await issueQuotation(selections, {
    customerName: "ZZ TEST Pelanggan Ticketing",
    customerPhone: "0812-0000-0000",
    internalNote: "Dibuat scripts/buat-quotation-uji-lokal.mts untuk uji Ticketing",
    ownerUserId: sales.id,
    salesName: sales.salesDisplayName ?? sales.name,
    createdByUserId: sales.id,
  })
  if (!result.ok) throw new Error(result.error)

  const quote = await prisma.pcBuildQuote.findUnique({
    where: { code: result.code },
    select: { items: true },
  })
  const items = Array.isArray(quote?.items) ? (quote.items as { stepName?: string | null; name?: string }[]) : []

  console.log(`\nTerbit: ${result.code}`)
  console.log(`Token publik: ${result.token}`)
  console.log(`Sales: ${sales.salesDisplayName ?? sales.name} (${sales.email})`)
  for (const item of items) console.log(`  - [${item.stepName ?? "—"}] ${item.name ?? ""}`)
  console.log(`\nUji:  GET /api/integrations/ticketing/pc-build-quotes/${result.code}`)
  console.log(`      GET /api/integrations/ticketing/pc-build-quotes/by-token/${result.token}`)
} catch (error) {
  console.error(`GAGAL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
