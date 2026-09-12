/**
 * Verifikasi Fase 3 — penerapan harga lewat penambat `products.accurate_code`.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-fase3-harga-accurate.mts
 *
 * `--tsconfig` WAJIB: `accurate-price.ts` mengimpor `server-only`, dan paket itu
 * tidak ada di `node_modules` — Next.js menyelesaikannya di bundler. Tanpa
 * tsconfig uji (yang mengalihkannya ke `scripts/stubs/`), Node gagal memuat
 * modulnya sama sekali.
 *
 * Yang diuji adalah FUNGSI SUNGGUHAN (`buildAccuratePricePreview`,
 * `buildProductLogEntries`), bukan salinan SQL-nya. `DATABASE_URL` ditimpa ke
 * database uji SEBELUM modulnya diimpor, jadi `getPrisma()` di dalam layanan itu
 * menyambung ke uji — bukan produksi. Kalau `RESTORE_UJI_DATABASE_URL` tidak ada,
 * skrip berhenti; ia TIDAK pernah jatuh ke produksi.
 *
 * Menulis entitas buangan berawalan "ZZ TEST" (konvensi project) ke `products`,
 * `product_logs`, dan `accurate_products` di database uji, lalu menghapusnya
 * lagi di blok `finally` — termasuk kalau ada uji yang gagal di tengah.
 *
 * Yang dibuktikan (semua aturan dari docs/13):
 *   §6   harga yang terakhir disunting MANUSIA dilewati sinkronisasi
 *   §6.2 baris itu tetap muncul di pratinjau, tidak disembunyikan
 *   §5   angka mencurigakan ditandai, bukan ditebak/dikoreksi
 *   §3.5 penambat menentukan pasangan — bukan skor kemiripan nama
 *   §6.1 penerapan tercatat SYNC_PRICE, suntingan panel UPDATE_PRICE
 */
import { readFileSync } from "node:fs"

/**
 * `.env.local` dimuat sendiri: skrip ini bukan proses Next, jadi tidak ada yang
 * mengisi process.env untuknya — dan `@/config/env` memvalidasi SELURUH env saat
 * modulnya dimuat, bukan hanya DATABASE_URL.
 */
const isiEnv = readFileSync(".env.local", "utf8")
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}

const uji = process.env.RESTORE_UJI_DATABASE_URL
if (!uji) {
  console.error("RESTORE_UJI_DATABASE_URL tidak ada di .env.local — berhenti (tidak menyentuh produksi).")
  process.exit(1)
}

// Ditimpa SEBELUM import dinamis di bawah. `@/config/env` membaca process.env
// saat modulnya dimuat, jadi urutannya yang menentukan.
process.env.DATABASE_URL = uji

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const { buildAccuratePricePreview } = await import("../src/lib/services/accurate-price.ts")
const { buildProductLogEntries } = await import("../src/lib/logs/product-log.ts")

const prisma = getPrisma()
const namaDb = new URL(uji.replace(/^mysql:/, "http:")).pathname.slice(1)
console.log(`\nDatabase : ${namaDb}  (uji — bukan produksi)\n`)

let lulus = 0
let gagal = 0
function cek(nama: string, benar: boolean, detail = "") {
  if (benar) {
    lulus++
    console.log(`  OK   ${nama}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama}${detail ? ` — ${detail}` : ""}`)
  }
}

/** Rentang woo_id buangan. Dicek bentrok dulu sebelum dipakai. */
const WOO_DASAR = 99990000
const KODE_AWALAN = "ZZTEST"

/**
 * Enam skenario. `manualJam`/`syncJam` = jam LALU (semakin kecil = semakin baru),
 * null = log itu tidak ada sama sekali.
 */
const SKENARIO = [
  { n: 1, label: "hanya UPDATE_PRICE (belum pernah disinkronkan)", manualJam: 2, syncJam: null, sp: "5000000", harap: true },
  { n: 2, label: "hanya SYNC_PRICE", manualJam: null, syncJam: 2, sp: "5000000", harap: false },
  { n: 3, label: "UPDATE_PRICE lalu SYNC_PRICE (sync lebih baru)", manualJam: 5, syncJam: 1, sp: "5000000", harap: false },
  { n: 4, label: "SYNC_PRICE lalu UPDATE_PRICE (manusia lebih baru)", manualJam: 1, syncJam: 5, sp: "5000000", harap: true },
  { n: 5, label: "tanpa log harga sama sekali", manualJam: null, syncJam: null, sp: "5000000", harap: false },
  { n: 6, label: "harga Accurate janggal (145)", manualJam: null, syncJam: null, sp: "145", harap: false },
] as const

const wooIds = SKENARIO.map((s) => WOO_DASAR + s.n)
const kodeUji = SKENARIO.map((s) => `${KODE_AWALAN}${s.n}`)

async function bersihkan() {
  await prisma.productLog.deleteMany({ where: { productId: { in: [...wooIds] } } })
  await prisma.product.deleteMany({ where: { wooId: { in: [...wooIds] } } })
  for (const k of kodeUji) {
    await prisma.$executeRawUnsafe("DELETE FROM accurate_products WHERE `Kode Accurate` = ?", k)
  }
}

try {
  // ── Pra-syarat: rentang buangan benar-benar kosong ────────────────────────
  const bentrok = await prisma.product.count({ where: { wooId: { in: [...wooIds] } } })
  if (bentrok > 0) {
    console.error(`woo_id uji ${WOO_DASAR}+ sudah dipakai ${bentrok} produk sungguhan — ganti rentangnya.`)
    process.exit(1)
  }

  // ── Baseline: pratinjau SEBELUM data uji masuk ────────────────────────────
  const sebelum = await buildAccuratePricePreview()
  console.log("Pratinjau awal (data uji belum masuk):")
  console.log(`  tertaut ${sebelum.ringkasan.totalTerpetakan} · harga beda ${sebelum.ringkasan.hargaBeda} · disunting staff ${sebelum.ringkasan.disuntingManusia} · peringatan ${sebelum.ringkasan.adaPeringatan}\n`)
  cek("pratinjau terbaca (tabel accurate_products ada)", sebelum.configured)

  // ── Siapkan 6 produk uji + barisan Accurate-nya ───────────────────────────
  const sekarang = Date.now()
  for (const s of SKENARIO) {
    const woo = WOO_DASAR + s.n
    const kode = `${KODE_AWALAN}${s.n}`

    await prisma.$executeRawUnsafe(
      "INSERT INTO accurate_products (`Kode Accurate`, `NAMA BARANG`, `SP`) VALUES (?, ?, ?)",
      kode,
      `ZZ TEST BARANG ${s.n}`,
      s.sp,
    )

    await prisma.product.create({
      data: {
        wooId: woo,
        type: "SIMPLE",
        status: "PUBLISHED",
        name: `ZZ TEST PRODUK ${s.n}`,
        slug: `zz-test-produk-${s.n}`,
        accurateCode: kode,
        // Harga web sengaja beda dari SP supaya barisnya masuk "dapat diterapkan".
        regularPrice: 4000000,
      },
    })

    // `product_logs.product_id` menyimpan wooId, BUKAN products.id — keliru di
    // sini membuat penandaan menunjuk produk acak.
    const log = (action: string, jamLalu: number) =>
      prisma.productLog.create({
        data: {
          userName: "ZZ TEST",
          productId: woo,
          productName: `ZZ TEST PRODUK ${s.n}`,
          action,
          fieldAffected: "regular_price",
          oldValue: "1",
          newValue: "2",
          createdAt: new Date(sekarang - jamLalu * 3_600_000),
        },
      })

    if (s.manualJam !== null) await log("UPDATE_PRICE", s.manualJam)
    if (s.syncJam !== null) await log("SYNC_PRICE", s.syncJam)
  }

  // ── Uji §6 + §6.2 + §5 lewat fungsi pratinjau yang sungguhan ──────────────
  console.log("Aturan §6 — suntingan manusia dilewati sinkronisasi:")
  const sesudah = await buildAccuratePricePreview()
  const perKode = new Map(sesudah.rows.map((r) => [r.kodeAccurate, r]))

  for (const s of SKENARIO) {
    const baris = perKode.get(`${KODE_AWALAN}${s.n}`)
    if (!baris) {
      cek(`#${s.n} ${s.label}`, false, "barisnya tidak muncul di pratinjau (§6.2 dilanggar)")
      continue
    }
    cek(
      `#${s.n} ${s.label} → disuntingManusia=${s.harap}`,
      baris.disuntingManusia === s.harap,
      `dapatnya ${baris.disuntingManusia}`,
    )
  }

  console.log("\nAturan §6.2 — yang dilewati tetap tampil, tidak disembunyikan:")
  cek("keenam baris uji ada di pratinjau", SKENARIO.every((s) => perKode.has(`${KODE_AWALAN}${s.n}`)))

  console.log("\nAturan §5 — angka janggal ditandai, bukan ditebak:")
  const janggal = perKode.get(`${KODE_AWALAN}6`)!
  cek("harga 145 TIDAK dikalikan seribu", janggal.hargaAccurate.nilai === 145, `dapatnya ${janggal.hargaAccurate.nilai}`)
  cek("harga 145 diberi peringatan", janggal.peringatan !== null, String(janggal.peringatan))

  console.log("\nAturan §3.5 — penambat menentukan pasangan:")
  const p1 = perKode.get(`${KODE_AWALAN}1`)!
  cek("baris tertaut ke produk web yang benar", p1.wooId === WOO_DASAR + 1, `dapatnya woo ${p1.wooId}`)
  cek("harga web terbaca dari produk itu", p1.hargaWebSekarang === 4_000_000, String(p1.hargaWebSekarang))
  cek("selisih dihitung (5jt vs 4jt = +25%)", Math.round(p1.selisihPersen ?? 0) === 25, String(p1.selisihPersen))

  console.log("\nRingkasan ikut bertambah:")
  const tambahanDisunting = sesudah.ringkasan.disuntingManusia - sebelum.ringkasan.disuntingManusia
  cek("kartu 'Disunting staff' naik 2 (skenario 1 & 4)", tambahanDisunting === 2, `naik ${tambahanDisunting}`)
  cek(
    "kartu 'Tertaut' naik 6",
    sesudah.ringkasan.totalTerpetakan - sebelum.ringkasan.totalTerpetakan === 6,
    `naik ${sesudah.ringkasan.totalTerpetakan - sebelum.ringkasan.totalTerpetakan}`,
  )

  console.log("\nUrutan — yang siap diterapkan di atas yang disunting manusia:")
  const posisi = (n: number) => sesudah.rows.findIndex((r) => r.kodeAccurate === `${KODE_AWALAN}${n}`)
  cek("skenario 2 (siap) di atas skenario 1 (disunting)", posisi(2) < posisi(1), `${posisi(2)} vs ${posisi(1)}`)

  // ── Uji §6.1 — pemisahan aksi log (fungsi murni, tanpa DB) ────────────────
  console.log("\nAturan §6.1 — penerapan tercatat SYNC_PRICE, bukan UPDATE_PRICE:")
  const perubahan = [{ field: "regular_price", old: "4000000", new: "5000000" }]
  const dariSync = buildProductLogEntries(perubahan, { priceAction: "SYNC_PRICE" })
  const dariPanel = buildProductLogEntries(perubahan)
  cek("sinkronisasi → SYNC_PRICE", dariSync[0]?.action === "SYNC_PRICE", dariSync[0]?.action)
  cek("suntingan panel → UPDATE_PRICE", dariPanel[0]?.action === "UPDATE_PRICE", dariPanel[0]?.action)
} finally {
  await bersihkan()
  const sisa = await prisma.product.count({ where: { wooId: { in: [...wooIds] } } })
  console.log(`\nPembersihan: ${sisa === 0 ? "bersih, tidak ada sisa ZZ TEST" : `MASIH ADA ${sisa} SISA — periksa manual`}`)
  await prisma.$disconnect()
}

console.log(`\n${lulus} lulus, ${gagal} gagal\n`)
process.exit(gagal === 0 ? 0 : 1)
