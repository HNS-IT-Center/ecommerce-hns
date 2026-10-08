/**
 * Verifikasi quotation PC Prebuild (docs/17 §18).
 *
 * MENULIS ke database yang sedang aktif — HANYA database lokal (docs/16); skrip
 * menolak jalan kalau DATABASE_URL bukan 127.0.0.1/localhost. Yang disentuh,
 * dan semuanya dikembalikan di blok `finally`:
 *  - pengaturan `PC_PREBUILD_CONFIG` (potongan dipasang sementara pada satu paket),
 *  - quotation uji bernama pelanggan "ZZ TEST QC Prebuild" (dihapus),
 *  - penghitung nomor urut bulan ini (dikembalikan ke angka semula).
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji-next.json --conditions=react-server \
 *     scripts/uji-quotation-prebuild.mts
 *
 * `tsconfig.uji-next.json`, bukan `tsconfig.uji.json`: konfigurasi paket dibaca
 * lewat `unstable_cache`, yang hanya hidup di dalam Next (lihat stubs/next-cache.ts).
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? "")) {
  console.error("DATABASE_URL bukan database lokal — skrip tulis ini dibatalkan.")
  process.exit(1)
}

const { getPrisma } = await import("../src/lib/prisma/client")
const Q = await import("../src/lib/api/pc-build-quotes")
const { parsePrebuildConfig, PC_PREBUILD_SETTING_KEY } = await import("../src/lib/pc-prebuild/config")
const { resolvePrebuildPresets } = await import("../src/lib/pc-prebuild/resolve")
const { getPcBuilderConfig } = await import("../src/lib/pc-builder/config")
const { summarizeBuildSavings } = await import("../src/lib/pc-builder/savings")
const { jakartaPeriod } = await import("../src/lib/utils/timezone")
import type { Prisma } from "@prisma/client"

let gagal = 0
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap)
  if (!ok) gagal++
  console.log(`${ok ? "LOLOS" : "GAGAL"}  ${nama}`)
  if (!ok) console.log(`        dapat: ${JSON.stringify(dapat)}\n        harap: ${JSON.stringify(harap)}`)
}

const prisma = getPrisma()
const PELANGGAN = "ZZ TEST QC Prebuild"
const periode = jakartaPeriod(new Date())

const settingAsli = await prisma.setting.findUnique({ where: { key: PC_PREBUILD_SETTING_KEY } })
if (!settingAsli) {
  console.error("PC_PREBUILD_CONFIG belum ada di database lokal — tidak ada paket untuk diuji.")
  process.exit(1)
}
const counterAsli = await prisma.$queryRaw<{ last_number: number | bigint }[]>`
  SELECT last_number FROM pc_build_quote_counters WHERE period = ${periode}`
const user = await prisma.user.findFirstOrThrow({ select: { id: true } })

const owner = {
  customerName: PELANGGAN,
  customerPhone: null,
  internalNote: "uji otomatis",
  ownerUserId: user.id,
  salesName: "ZZ",
  createdByUserId: user.id,
}

/** Tulis ulang konfigurasi dengan potongan tertentu pada satu paket. */
async function pasangPotongan(presetId: string, discount: unknown) {
  const raw = structuredClone(settingAsli!.value) as { enabled?: boolean; presets: Record<string, unknown>[] }
  raw.enabled = true
  for (const p of raw.presets) {
    if (p.id !== presetId) continue
    if (discount === null) delete p.discount
    else p.discount = discount
  }
  await prisma.setting.update({
    where: { key: PC_PREBUILD_SETTING_KEY },
    data: { value: raw as unknown as Prisma.InputJsonValue },
  })
}

async function baris(code: string) {
  return prisma.pcBuildQuote.findUniqueOrThrow({
    where: { code },
    include: { revisions: { orderBy: { revision: "asc" } } },
  })
}

try {
  // Paket yang paling banyak punya pilihan tukar — supaya uji pilihan bermakna.
  const cfg = parsePrebuildConfig(settingAsli.value)
  const preset = [...cfg.presets].sort(
    (a, b) =>
      b.slots.flatMap((s) => s.items).filter((i) => i.alternatives.length).length -
      a.slots.flatMap((s) => s.items).filter((i) => i.alternatives.length).length,
  )[0]
  if (!preset) throw new Error("Tidak ada paket di konfigurasi lokal.")
  console.log(`INFO   paket uji: ${preset.name} (${preset.id})`)

  const [resolved] = await resolvePrebuildPresets([preset], await getPcBuilderConfig(), "actual")
  const bawaan = resolved.items.map((item) => {
    const k = [item, ...item.alternatives].find((r) => r.product !== null)!
    return { id: k.variationId ?? k.productId, qty: k.quantity }
  })
  const idBawaan = [...new Set(bawaan.map((b) => b.id))].sort((a, b) => a - b)

  // ---------- A. terbit dengan potongan aktif ----------
  await pasangPotongan(preset.id, { amount: 250000, endsAt: null })
  const a = await Q.issuePrebuildQuotation(preset.id, {}, owner)
  cek("A: terbit ok", a.ok, true)
  if (!a.ok) throw new Error(a.error)
  const ra = await baris(a.code)
  const subA = Number(ra.subtotal)
  cek("A: kind = prebuild", ra.kind, "prebuild")
  cek("A: prebuildId tersimpan", ra.prebuildId, preset.id)
  cek("A: prebuildName = salinan nama paket", ra.prebuildName, preset.name)
  cek("A: potongan 250.000", Number(ra.discount), 250000)
  cek("A: total = subtotal - potongan", Number(ra.total), subA - 250000)
  cek("A: Rev.1 ikut mencatat potongan & total", [Number(ra.revisions[0].discount), Number(ra.revisions[0].total)], [250000, subA - 250000])
  cek("A: nomor urut (internal)", ra.sequence !== null, true)
  const idA = [...new Set((ra.items as { productId: number }[]).map((i) => i.productId))].sort((x, y) => x - y)
  cek("A: komponen = bawaan paket", idA, idBawaan)
  const hemat = summarizeBuildSavings([], Number(ra.total), Number(ra.discount))
  cek("A: total sebelum diskon = total + potongan", hemat.totalBeforeDiscount, subA)

  // ---------- B. pilihan tukar ----------
  const cabangIdx = resolved.items.findIndex((i) => i.alternatives.some((x) => x.product !== null))
  const kodeB: string[] = []
  if (cabangIdx >= 0) {
    const item = resolved.items[cabangIdx]
    const alt = item.alternatives.find((x) => x.product !== null)!
    const altId = alt.variationId ?? alt.productId
    const b = await Q.issuePrebuildQuotation(preset.id, { [`${item.stepId}#${cabangIdx}`]: altId }, owner)
    cek("B: terbit dengan pilihan tukar ok", b.ok, true)
    if (b.ok) {
      kodeB.push(b.code)
      const ids = (await baris(b.code)).items as { productId: number }[]
      cek("B: komponen pilihan tukar dipakai", ids.some((i) => i.productId === altId), true)
    }
  } else {
    console.log("INFO   paket tanpa pilihan tukar tersedia — uji B dilewati")
  }

  // ---------- C. pilihan palsu jatuh ke bawaan ----------
  const kunciPertama = `${resolved.items[0].stepId}#0`
  const c = await Q.issuePrebuildQuotation(preset.id, { [kunciPertama]: 999999999, "kunci-palsu#9": 1 }, owner)
  cek("C: pilihan palsu tetap terbit", c.ok, true)
  if (c.ok) {
    const idC = [...new Set(((await baris(c.code)).items as { productId: number }[]).map((i) => i.productId))].sort((x, y) => x - y)
    cek("C: pilihan palsu jatuh ke bawaan (bukan produk asing)", idC, idBawaan)
  }

  // ---------- D. revisi komponen di builder ditolak ----------
  const d = await Q.reviseQuotation(a.code, user.id, {
    selections: bawaan.map((x) => ({ stepId: null, productId: x.id, quantity: x.qty })),
    customerName: PELANGGAN,
    customerPhone: null,
    internalNote: null,
    useLatestPrices: false,
  })
  cek("D: revisi komponen quotation prebuild ditolak", d.ok, false)
  cek("D: seed revisi membawa kind", (await Q.getQuotationForRevision(a.code, user.id))?.kind, "prebuild")

  // ---------- E. Gunakan Harga Terbaru menilai ulang potongan ----------
  await pasangPotongan(preset.id, { amount: 400000, endsAt: null })
  const pv = await Q.previewLatestPrices(a.code, user.id)
  cek("E: pratinjau total lama = total tersimpan", pv.ok ? pv.totalSekarang : null, subA - 250000)
  cek("E: pratinjau total baru pakai potongan baru", pv.ok ? pv.totalBaru : null, subA - 400000)
  const e1 = await Q.refreshQuotationPrices(a.code, user.id)
  cek("E: segarkan ok", e1.ok, true)
  const re1 = await baris(a.code)
  cek("E: potongan ikut konfigurasi hari ini (400.000)", [Number(re1.discount), Number(re1.total), re1.revision], [400000, subA - 400000, 2])
  cek("E: Rev.2 mencatat potongan baru", Number(re1.revisions[1].discount), 400000)
  await pasangPotongan(preset.id, null)
  await Q.refreshQuotationPrices(a.code, user.id)
  const re2 = await baris(a.code)
  cek("E: potongan dicabut staff -> 0, total = subtotal", [Number(re2.discount), Number(re2.total)], [0, Number(re2.subtotal)])

  // ---------- F/G. potongan kedaluwarsa & potongan >= total ----------
  await pasangPotongan(preset.id, { amount: 250000, endsAt: "2020-01-01" })
  const f = await Q.issuePrebuildQuotation(preset.id, {}, owner)
  cek("F: potongan kedaluwarsa -> 0", f.ok ? Number((await baris(f.code)).discount) : null, 0)
  await pasangPotongan(preset.id, { amount: 999_000_000, endsAt: null })
  const g = await Q.issuePrebuildQuotation(preset.id, {}, owner)
  cek("G: potongan >= total tidak diberlakukan", g.ok ? Number((await baris(g.code)).discount) : null, 0)

  // ---------- H. jalur PC Build tidak berubah ----------
  const h = await Q.issueQuotation(bawaan.map((x) => ({ stepId: null, productId: x.id, quantity: x.qty })), owner)
  cek("H: quotation PC Build terbit", h.ok, true)
  const rh = h.ok ? await baris(h.code) : null
  cek("H: PC Build kind=build, potongan 0, total=subtotal", rh ? [rh.kind, Number(rh.discount), Number(rh.total) === Number(rh.subtotal)] : null, ["build", 0, true])

  // ---------- I. filter Jenis ----------
  const pre = await Q.listQuotationsForUser(user.id, { jenis: "prebuild", q: PELANGGAN })
  const bld = await Q.listQuotationsForUser(user.id, { jenis: "build", q: PELANGGAN })
  cek("I: filter prebuild memuat A, tidak memuat H", [pre.some((r) => r.code === a.code), pre.some((r) => h.ok && r.code === h.code)], [true, false])
  cek("I: filter build memuat H, tidak memuat A", [bld.some((r) => h.ok && r.code === h.code), bld.some((r) => r.code === a.code)], [true, false])
  cek("I: baris riwayat membawa nama paket", pre.find((r) => r.code === a.code)?.prebuildName, preset.name)
  const adm = await Q.listQuotationsForAdmin({ jenis: "prebuild", q: PELANGGAN })
  cek("I: admin filter prebuild hanya prebuild", adm.rows.every((r) => r.kind === "prebuild") && adm.rows.length > 0, true)
  const pub = await Q.getQuoteByPublicToken(ra.publicToken!)
  cek("I: /q membawa potongan & nama paket", [pub?.prebuildName, pub?.discount], [preset.name, 0])

  // ---------- K. paket tidak dikenal ----------
  cek("K: paket tidak dikenal ditolak", (await Q.issuePrebuildQuotation("tidak-ada", {}, owner)).ok, false)
} finally {
  await prisma.setting.update({
    where: { key: PC_PREBUILD_SETTING_KEY },
    data: { value: settingAsli.value as Prisma.InputJsonValue },
  })
  const dihapus = await prisma.pcBuildQuote.deleteMany({ where: { customerName: PELANGGAN } })
  if (counterAsli.length > 0) {
    await prisma.$executeRaw`UPDATE pc_build_quote_counters SET last_number = ${Number(counterAsli[0].last_number)} WHERE period = ${periode}`
  } else {
    await prisma.$executeRaw`DELETE FROM pc_build_quote_counters WHERE period = ${periode}`
  }
  const sisa = await prisma.pcBuildQuote.count({ where: { customerName: PELANGGAN } })
  const settingSekarang = await prisma.setting.findUnique({ where: { key: PC_PREBUILD_SETTING_KEY } })
  cek(`bersih: ${dihapus.count} quotation uji dihapus, tak ada sisa`, sisa, 0)
  cek("bersih: konfigurasi paket kembali persis", JSON.stringify(settingSekarang?.value), JSON.stringify(settingAsli.value))
  await prisma.$disconnect()
}

console.log(gagal === 0 ? "\nSemua lolos." : `\n${gagal} pemeriksaan GAGAL.`)
process.exit(gagal === 0 ? 0 : 1)
