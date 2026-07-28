/**
 * Task #2 — gabungkan brand duplikat, lalu isi brandId dari kategori brand.
 *
 * Tabel `brands` punya beberapa baris untuk merek yang sama, hasil import lama
 * yang membedakan huruf besar/kecil ("ACER" vs "Acer"). Produknya terbelah di
 * antara kedua baris, dan kategori brand justru menunjuk ke baris yang lebih
 * jarang dipakai. Kalau backfill dijalankan tanpa membereskan ini dulu, produk
 * malah menempel ke baris yang salah dan duplikatnya jadi makin sulit dicabut.
 *
 * Urutan kerja:
 *   1. Gabung  — semua produk dipindah ke baris ber-slug bersih (tanpa akhiran
 *                "-2"), baris duplikatnya dihapus. Slug ikut dipertahankan
 *                karena dipakai di URL.
 *   2. Backfill — produk yang brandId-nya masih NULL diisi dari kategori brand
 *                yang menempel padanya.
 *
 * Produk yang brandId-nya SUDAH terisi tidak pernah ditimpa. Sebagian di
 * antaranya memang beda dari kategorinya (mis. brand "RYZEN" pada produk di
 * kategori "AMD") dan itu keputusan taksonomi, bukan data rusak — biar
 * diputuskan manusia, bukan script ini.
 *
 * Default-nya DRY RUN. Tambahkan --apply untuk benar-benar menulis.
 * Sebelum menulis, baris yang terdampak di-dump ke scripts/backup-*.json.
 */
import { config } from "dotenv"
config({ path: ".env.local" })

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const APPLY = process.argv.includes("--apply")

const base = (process.env.DATABASE_URL as string)
  .replace(/^['"]|['"]$/g, "")
  .replace(/^mysql:\/\//, "mariadb://")
const sep = base.includes("?") ? "&" : "?"
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(`${base}${sep}connectionLimit=2&acquireTimeout=30000`, {
    useTextProtocol: true,
  }),
})

const norm = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ")

/** Slug hasil tabrakan diberi akhiran angka oleh import lama ("acer-2"). */
const isCollisionSlug = (slug: string) => /-\d+$/.test(slug)

async function main() {
  console.log(APPLY ? "*** MODE: APPLY (menulis ke DB) ***" : "--- MODE: DRY RUN (tidak menulis) ---")

  const brands = await prisma.brand.findMany({ select: { id: true, name: true, slug: true } })
  const categories = await prisma.category.findMany({ select: { id: true, name: true, path: true } })
  const products = await prisma.product.findMany({
    select: { id: true, wooId: true, name: true, brandId: true, categories: { select: { categoryId: true } } },
  })

  const productCount = new Map<number, number>()
  for (const p of products) {
    if (p.brandId !== null) productCount.set(p.brandId, (productCount.get(p.brandId) ?? 0) + 1)
  }

  // ---------------------------------------------------------------- 1. gabung
  const groups = new Map<string, typeof brands>()
  for (const b of brands) {
    const k = norm(b.name)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(b)
  }

  type Merge = { keep: (typeof brands)[number]; drop: (typeof brands)[number][]; moves: number }
  const merges: Merge[] = []

  for (const [, rows] of groups) {
    if (rows.length < 2) continue

    // Pertahankan baris ber-slug bersih; kalau semua bersih/semua bertabrakan,
    // pilih id terkecil supaya hasilnya deterministik.
    const clean = rows.filter((r) => !isCollisionSlug(r.slug))
    const keep = (clean.length > 0 ? clean : rows).sort((a, b) => a.id - b.id)[0]
    const drop = rows.filter((r) => r.id !== keep.id)
    const moves = drop.reduce((a, r) => a + (productCount.get(r.id) ?? 0), 0)
    merges.push({ keep, drop, moves })
  }

  console.log("\n=== 1. GABUNG BRAND DUPLIKAT ===")
  if (merges.length === 0) console.log("  (tidak ada duplikat)")
  for (const m of merges) {
    console.log(
      `  PERTAHANKAN #${m.keep.id} "${m.keep.name}" (slug=${m.keep.slug}, ${productCount.get(m.keep.id) ?? 0} produk)`
    )
    for (const d of m.drop) {
      console.log(
        `     hapus    #${d.id} "${d.name}" (slug=${d.slug}) — ${productCount.get(d.id) ?? 0} produk dipindah`
      )
    }
  }
  console.log(`  total produk dipindah: ${merges.reduce((a, m) => a + m.moves, 0)}`)

  // Peta id lama -> id kanonik, dipakai saat menghitung backfill.
  const remap = new Map<number, number>()
  for (const m of merges) for (const d of m.drop) remap.set(d.id, m.keep.id)
  const canonical = (id: number) => remap.get(id) ?? id

  // -------------------------------------------------------------- 2. backfill
  const brandByName = new Map<string, number>()
  for (const b of brands) if (!brandByName.has(norm(b.name))) brandByName.set(norm(b.name), b.id)

  // Kategori yang namanya kebetulan sama dengan nama brand belum tentu menandai
  // merek produknya. Di bawah "VGA CARD / GRAPHICS CARD", nama NVIDIA dan AMD
  // menunjuk chipset — kartunya sendiri buatan MSI, ASUS, Zotac. Untuk CPU beda
  // cerita: prosesor di "PROCESSOR > INTEL" memang bermerek Intel. Jadi yang
  // dikecualikan adalah subpohon VGA-nya, bukan nama brand-nya.
  const CHIPSET_PARENT_PATHS = ["VGA CARD", "GRAPHICS CARD"]
  const isChipsetCategory = (path: string) =>
    CHIPSET_PARENT_PATHS.some((p) => path.toUpperCase().includes(p))

  const catToBrand = new Map<number, number>()
  const excluded: string[] = []
  for (const c of categories) {
    const hit = brandByName.get(norm(c.name))
    if (hit === undefined) continue
    if (isChipsetCategory(c.path)) {
      excluded.push(c.path)
      continue
    }
    catToBrand.set(c.id, canonical(hit))
  }

  /**
   * Pengecualian yang sudah ditinjau manual, per woo_id. Ditulis di sini supaya
   * keputusannya ikut ter-review lewat git, bukan tersembunyi di kepala orang
   * yang menjalankan script.
   */
  const REVIEWED_SKIP = new Map<number, string>([
    [
      31268,
      "ASUS TUF GAMING F16 FX608JHR nyasar di kategori LAPTOP GAMING > ROG, " +
        "padahal tiga varian TUF F16 lainnya (woo 21878, 22541, 31359) ada di " +
        "LAPTOP GAMING > TUF Gaming dan semuanya brand ASUS. Kategorinya yang " +
        "salah, bukan brand-nya — betulkan lewat task #6, jangan ditambal di sini.",
    ],
  ])

  const fills: { id: number; wooId: number; name: string; brandId: number }[] = []
  const reviewedSkips: string[] = []
  let skippedHasBrand = 0
  let skippedAmbiguous = 0

  for (const p of products) {
    const hits = [...new Set(p.categories.map((c) => catToBrand.get(c.categoryId)).filter((x): x is number => x !== undefined))]
    if (hits.length === 0) continue
    if (hits.length > 1) {
      skippedAmbiguous += 1
      continue
    }
    if (p.brandId !== null) {
      skippedHasBrand += 1
      continue
    }
    const reviewed = REVIEWED_SKIP.get(p.wooId)
    if (reviewed) {
      reviewedSkips.push(`woo#${p.wooId} ${p.name.slice(0, 46)}\n          ${reviewed}`)
      continue
    }
    fills.push({ id: p.id, wooId: p.wooId, name: p.name, brandId: hits[0] })
  }

  const brandName = new Map(brands.map((b) => [b.id, b.name]))
  console.log("\n=== 2. BACKFILL brandId DARI KATEGORI ===")
  console.log(`  kategori yang dikenali sebagai brand: ${catToBrand.size}`)
  console.log(`  dikecualikan (kategori chipset)     : ${excluded.length}`)
  for (const p of excluded) console.log(`     ${p}`)
  console.log(`  AKAN DIISI                          : ${fills.length}`)
  console.log(`  dilewati (brandId sudah terisi)     : ${skippedHasBrand}`)
  console.log(`  dilewati (>1 kategori brand)        : ${skippedAmbiguous}`)
  console.log(`  dilewati (ditinjau manual)          : ${reviewedSkips.length}`)
  for (const s of reviewedSkips) console.log(`     ${s}`)

  const perBrand = new Map<number, number>()
  for (const f of fills) perBrand.set(f.brandId, (perBrand.get(f.brandId) ?? 0) + 1)
  console.log("  rincian:")
  for (const [bid, n] of [...perBrand.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(4)} produk -> #${bid} ${brandName.get(bid)}`)
  }
  console.log("  contoh:")
  for (const f of fills.slice(0, 5)) {
    console.log(`     woo#${f.wooId} ${f.name.slice(0, 52)} -> ${brandName.get(f.brandId)}`)
  }

  // Pengaman: sebagian kategori sebenarnya chipset, bukan merek. "VGA CARD >
  // NVIDIA" berisi kartu buatan MSI, ASUS, Zotac — NVIDIA cuma pembuat chip-nya.
  // Kalau nama produk memuat merek lain, kategori itu tidak boleh dipakai
  // sebagai sumber brand. Backfill dibatalkan supaya tidak menanam data salah.
  // Nama merek yang muncul di judul produk biasanya menyebut komponen di
  // DALAMNYA, bukan pembuat produknya — "ACER ASPIRE ... RYZEN 7" tetap laptop
  // Acer. Jadi kontradiksi hanya dihitung kalau merek yang mau dipasang sama
  // sekali tidak disebut, sementara merek lain disebut. Itu pola "VGA CARD MSI
  // GTX 1650" yang mau diberi brand NVIDIA.
  //
  // Pembanding dibatasi ke brand yang benar-benar dipakai produk; tabel brands
  // masih memuat baris sampah seperti "lga1700" dan "RADEON" (0 produk) yang
  // bukan merek dan hanya menghasilkan alarm palsu.
  // Lini produk yang terlanjur tercatat sebagai merek tersendiri di tabel
  // brands. "PROCESSOR RYZEN 7 8700G" tetap produk AMD walau judulnya tidak
  // menyebut AMD, jadi ini bukan kontradiksi. Baris brand-nya sendiri yang
  // seharusnya dilebur — itu bagian dari task #3.
  const SUB_BRAND_OF = new Map<string, string>([
    ["RYZEN", "AMD"],
    ["RADEON", "AMD"],
    ["GEFORCE", "NVIDIA"],
    ["ROG", "ASUS"],
    ["TUF", "ASUS"],
  ])

  const realBrands = [...new Set(brands.filter((b) => (productCount.get(b.id) ?? 0) > 0).map((b) => norm(b.name)))]
    .filter((n) => n.length >= 3)
    .sort((a, b) => b.length - a.length)
  const contradictions = new Map<number, { total: number; sample: string[] }>()

  for (const f of fills) {
    const target = norm(brandName.get(f.brandId) ?? "")
    const n = norm(f.name)
    if (n.includes(target)) continue

    const found = realBrands.find(
      (bn) => bn !== target && SUB_BRAND_OF.get(bn) !== target && n.includes(bn)
    )
    if (!found) continue

    const entry = contradictions.get(f.brandId) ?? { total: 0, sample: [] }
    entry.total += 1
    if (entry.sample.length < 3) entry.sample.push(`${f.name.slice(0, 48)} (memuat "${found}")`)
    contradictions.set(f.brandId, entry)
  }

  if (contradictions.size > 0) {
    console.log("\n  !! PERINGATAN — nama produk memuat merek lain:")
    for (const [bid, e] of [...contradictions.entries()].sort((a, b) => b[1].total - a[1].total)) {
      console.log(`     ${String(e.total).padStart(4)}/${perBrand.get(bid)} produk yang mau diberi "${brandName.get(bid)}"`)
      for (const s of e.sample) console.log(`          ${s}`)
    }
  }

  if (!APPLY) {
    console.log("\n--- DRY RUN selesai. Jalankan ulang dengan --apply untuk menulis. ---")
    await prisma.$disconnect()
    return
  }

  // Kontradiksi yang tersisa berarti masih ada kategori yang salah dianggap
  // brand. Lebih baik berhenti daripada menanam ratusan brand keliru yang
  // nantinya harus dibersihkan manual.
  if (contradictions.size > 0) {
    const total = [...contradictions.values()].reduce((a, e) => a + e.total, 0)
    console.error(
      `\nDIBATALKAN: ${total} produk akan diberi brand yang bertentangan dengan namanya sendiri.` +
        `\nPeriksa daftar peringatan di atas — kemungkinan ada kategori chipset yang belum dikecualikan.` +
        `\nTidak ada satu baris pun yang ditulis.`
    )
    await prisma.$disconnect()
    process.exit(1)
  }

  // ----------------------------------------------------------------- backup
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backupPath = join("scripts", `backup-brands-${stamp}.json`)
  const affectedIds = new Set<number>([...fills.map((f) => f.id)])
  for (const p of products) if (p.brandId !== null && remap.has(p.brandId)) affectedIds.add(p.id)

  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        brands,
        products: products
          .filter((p) => affectedIds.has(p.id))
          .map((p) => ({ id: p.id, wooId: p.wooId, brandId: p.brandId })),
      },
      null,
      2
    )
  )
  console.log(`\nbackup ditulis: ${backupPath} (${affectedIds.size} produk, ${brands.length} brand)`)

  // ------------------------------------------------------------------ tulis
  let movedTotal = 0
  let filledTotal = 0

  await prisma.$transaction(
    async (tx) => {
      for (const m of merges) {
        for (const d of m.drop) {
          const r = await tx.product.updateMany({ where: { brandId: d.id }, data: { brandId: m.keep.id } })
          movedTotal += r.count
          await tx.brand.delete({ where: { id: d.id } })
        }
      }

      for (const [bid, ids] of groupByBrand(fills)) {
        const r = await tx.product.updateMany({
          where: { id: { in: ids }, brandId: null },
          data: { brandId: bid },
        })
        filledTotal += r.count
      }
    },
    { timeout: 120000 }
  )

  console.log(`\nSELESAI. produk dipindah: ${movedTotal} | brandId diisi: ${filledTotal}`)
  console.log(`Rollback: pakai ${backupPath} untuk mengembalikan brandId per produk.`)

  await prisma.$disconnect()
}

function groupByBrand(fills: { id: number; brandId: number }[]): Map<number, number[]> {
  const out = new Map<number, number[]>()
  for (const f of fills) {
    if (!out.has(f.brandId)) out.set(f.brandId, [])
    out.get(f.brandId)!.push(f.id)
  }
  return out
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
