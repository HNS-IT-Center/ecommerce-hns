/**
 * Migrasi #5A — beri kategori pada produk terbit yang belum punya rumah.
 *
 * Sembilan belas produk terbit tidak berada di kategori mana pun, jadi
 * penjelajahan tidak bisa menjangkaunya; hanya pencarian, dan hanya kalau
 * pembeli menebak kata yang tepat.
 *
 * Prinsip yang dipakai (keputusan user, 29 Juli 2026): lebih baik kategori
 * sedikit lebih umum tapi benar daripada kategori sangat spesifik hasil
 * tebakan. Karena itu casing yang namanya hanya menyebut dukungan motherboard
 * (ATX/mATX) berhenti di CASING PC, bukan ditebak jadi MID atau MICRO TOWER;
 * dan dua monitor yang tidak menyebut lengkung berhenti di MONITOR PC.
 *
 * Yang benar-benar tidak bisa diputuskan tidak dipaksakan — dilaporkan sebagai
 * "Perlu Keputusan PIC".
 *
 * Leluhur ikut ditambahkan mengikuti konvensi tabel ini, supaya halaman
 * kategori induk tetap melistkan produknya.
 *
 * Default DRY RUN. Tambahkan --apply untuk menulis.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const APPLY = process.argv.includes("--apply")
const { bulkAssignCategory, previewBulkAssignCategory, setPrimaryCategory } =
  await import("../src/lib/api/woocommerce/products")
const { getPrisma } = await import("../src/lib/prisma/client")

const p = getPrisma()
const tag = APPLY ? "[APPLY]" : "[DRY RUN]"

/** wooId -> jalur kategori terdalam yang disepakati. */
const PENEMPATAN: Array<[number, string, string]> = [
  [33028, "LAPTOP & PC > LAPTOP OFFICE", "ASUS VIVOBOOK GO 14 — namanya menyebut laptop"],
  [21136, "KOMPONEN PC / NB > LIQUID COOLING > 360mm", "KAZE KS360 — angka 360 di nama produk"],

  // Casing: nama hanya menyebut dukungan motherboard, bukan ukuran tower.
  [32328, "KOMPONEN PC / NB > CASING PC", "ALCATROZ AZZURA MILLENIA ECO AIR 1"],
  [32330, "KOMPONEN PC / NB > CASING PC", "ALCATROZ AZZURA MILLENIA ECO AIR 2"],
  [32298, "KOMPONEN PC / NB > CASING PC", "ALCATROZ AZZURA MILLENIA ECO M100"],
  [32332, "KOMPONEN PC / NB > CASING PC", "ALCATROZ AZZURA MILLENIA ECO M300"],
  [32637, "KOMPONEN PC / NB > CASING PC", "DEEPCOOL CL6600 - ATX"],
  [31582, "KOMPONEN PC / NB > CASING PC", "MSI MAG FORGE M120R AIRFLOW - ATX"],
  [32606, "KOMPONEN PC / NB > CASING PC", "PARADOX GAMING GLASS V2 - ATX"],
  [34321, "KOMPONEN PC / NB > CASING PC", "PARADOX GAMING HOMURA V2 - mATX"],
  [32613, "KOMPONEN PC / NB > CASING PC", "PARADOX GAMING RENGGANIS - mATX"],
  [34315, "KOMPONEN PC / NB > CASING PC", "PARADOX GAMING TRICKSTER V2 - ATX"],
  [7991, "KOMPONEN PC / NB > CASING PC", "THERMALTAKE THE TOWER 600 - ATX"],

  // Monitor: tidak menyebut flat maupun curved.
  [33490, "KOMPONEN PC / NB > MONITOR PC", "LG 27U411B-B 27\" IPS FHD"],
  [31746, "KOMPONEN PC / NB > MONITOR PC", "MSI MAG401QR 40\" IPS UWQHD"],

  // Kabel & converter.
  [16309, "AKSESSORIES KOMPUTER > KABEL / CONVERTER > KABEL DISPLAYPORT", "VENTION DisplayPort to HDMI"],
  [24517, "AKSESSORIES KOMPUTER > KABEL / CONVERTER", "UGREEN Type-C to SATA"],
  [24122, "AKSESSORIES KOMPUTER > KABEL / CONVERTER", "UGREEN Type-C to Type-C — belum ada kategori USB-C <-> USB-C"],
]

/** Tidak diputuskan — jangan dipaksakan. */
const PERLU_PIC: Array<[number, string]> = [
  [32283, "ARGB LED STRIP ARMAGGEDDON TESSARAXX 20CM — tidak tercakup keputusan"],
]

console.log(`${tag} Kategorikan produk terbit yang belum punya rumah\n`)

/** Jalur leluhur sebuah kategori, dari akar sampai kategori itu sendiri. */
async function chainOf(path: string): Promise<{ id: number; path: string }[]> {
  const target = await p.category.findFirst({ where: { path }, select: { id: true, parentId: true, path: true } })
  if (!target) throw new Error(`Kategori tidak ditemukan: ${path}`)
  const chain = [{ id: target.id, path: target.path }]
  let cursor = target.parentId
  while (cursor !== null) {
    const parent = await p.category.findUnique({ where: { id: cursor }, select: { id: true, parentId: true, path: true } })
    if (!parent) break
    chain.unshift({ id: parent.id, path: parent.path })
    cursor = parent.parentId
  }
  return chain
}

// Kelompokkan menurut kategori tujuan supaya satu operasi massal per kategori.
const perKategori = new Map<string, number[]>()
for (const [wooId, path] of PENEMPATAN) {
  if (!perKategori.has(path)) perKategori.set(path, [])
  perKategori.get(path)!.push(wooId)
}

for (const [path, wooIds] of perKategori) {
  console.log(`${path}  (${wooIds.length} produk)`)
  for (const [id, , label] of PENEMPATAN.filter(([, pth]) => pth === path).map((x) => x)) {
    console.log(`     ${label}`)
    void id
  }
  const chain = await chainOf(path)
  for (const step of chain) {
    const pv = await previewBulkAssignCategory(wooIds, step.id, "add")
    console.log(`     + ${step.path}: berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, step.id, "add", pv.willChange)
  }

  // Kategori terdalam jadi kategori utama — jalurnya tunggal, jadi tidak ambigu.
  if (APPLY) {
    const daun = chain[chain.length - 1]
    for (const wooId of wooIds) await setPrimaryCategory(wooId, daun.id)
    console.log(`     * kategori utama: ${daun.path}`)
  }
  console.log()
}

console.log("=== PERLU KEPUTUSAN PIC (tidak disentuh) ===")
for (const [wooId, alasan] of PERLU_PIC) console.log(`  wooId=${wooId} — ${alasan}`)

console.log(`\n${tag} selesai. Ditempatkan: ${PENEMPATAN.length}. Ditahan: ${PERLU_PIC.length}.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
