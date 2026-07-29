/**
 * Migrasi #5C — produk yang berhenti di kategori yang masih punya anak.
 *
 * Diukur ulang terhadap taksonomi terbaru: 218 produk, bukan 111 seperti
 * catatan lama. Angkanya naik justru karena pohonnya membaik — KONSOL GAME kini
 * punya anak, PC ALL IN ONE punya anak, dan kategori merek printer sudah
 * dibubarkan sehingga printer sendiri berhenti di induknya.
 *
 * Aturan user: jangan mengejar semua produk berada di daun. Produk boleh tetap
 * di kategori induk kalau induk itu memang mewakili jenis barangnya. Karena itu
 * 151 dari 218 sengaja TIDAK disentuh — printer yang memang printer, konsol
 * yang bukan handheld, UPS yang bukan baterai, casing yang tidak menyebut
 * ukuran tower, monitor yang tidak menyebut lengkung.
 *
 * Yang dikerjakan di sini hanya dua kelompok berkeyakinan tinggi: produk yang
 * namanya menyebut sendiri sub-kategorinya, dan produk yang jelas berada di
 * cabang yang salah.
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

/** Diperdalam: nama produk menyebut sub-kategorinya sendiri. */
const DIPERDALAM: Array<[number[], string, string]> = [
  [[24184, 32061, 32070, 32098], "KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > VGA NVIDIA", "VGA RTX -> chipset NVIDIA"],
  [[31737], "KOMPONEN PC / NB > MOTHERBOARD > MOTHERBOARD AMD", "X870E + soket AM5 -> platform AMD"],
  [[32689, 34350], "KOMPONEN PC / NB > LIQUID COOLING > 360mm", "LT360 / RYUO IV 360 -> radiator 360mm"],
  [[14147, 18247], "AKSESSORIES KOMPUTER > POWERBANK & CHARGER", "namanya powerbank"],
  [[17268], "AKSESSORIES KOMPUTER > HEADSET", "namanya headset"],
  [[24695, 31101], "PRINTER & PROYEKTOR", "printer — induknya memang rumahnya"],
]

/**
 * Salah pohon: dipindahkan ke cabang yang benar, dan dilepas dari cabang lama
 * supaya tidak terdaftar di dua tempat sekaligus.
 */
const SALAH_POHON: Array<[number[], string, string, string]> = [
  [
    [7558, 7563, 7568, 8956, 8962, 9616, 9811, 10711, 11712, 12468, 13094, 15262, 15273, 16248],
    "NETWORK TOOLS",
    "AKSESSORIES KOMPUTER",
    "router, switch, wifi adapter, range extender, network tester",
  ],
  // Akar lama ikut dilepas. Menambah cabang baru tanpa melepas yang lama hanya
  // mengubah "berhenti terlalu dangkal" jadi "terdaftar di dua pohon" — satu
  // masalah ditukar dengan masalah lain.
  [[16168, 26009], "AKSESSORIES KOMPUTER > MOUSE", "KOMPONEN PC / NB", "mouse"],
  [[22401, 31282, 31287, 31333], "AKSESSORIES KOMPUTER > PASTA THERMAL", "KOMPONEN PC / NB", "pasta / pad thermal"],
  [[24140], "AKSESSORIES KOMPUTER > COOLING PAD / STAND LAPTOP", "KOMPONEN PC / NB", "cooling pad laptop"],
  [[11594], "AKSESSORIES KOMPUTER > MODEM", "KOMPONEN PC / NB", "modem MiFi"],
  [[32435], "KOMPONEN PC / NB > FAN PROCESSOR", "", "cooler prosesor"],
  [[32939], "LAPTOP & PC > LAPTOP OFFICE", "KOMPONEN PC / NB", "laptop Acer Swift"],
  [[9576], "KOMPONEN PC / NB > MONITOR PC > BRACKET MONITOR", "AKSESSORIES KOMPUTER", "bracket monitor"],
  [[16035, 16044], "PRINTER & PROYEKTOR > REMOTE PRESENTASI", "AKSESSORIES KOMPUTER", "remote presentasi"],
]

console.log(`${tag} Perdalam & betulkan cabang produk yang berhenti di induk\n`)

async function chainOf(path: string) {
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

async function jalankan(wooIds: number[], tujuan: string, lepas: string, label: string) {
  console.log(`${label} (${wooIds.length} produk) -> ${tujuan}`)
  const chain = await chainOf(tujuan)
  for (const step of chain) {
    const pv = await previewBulkAssignCategory(wooIds, step.id, "add")
    console.log(`     + ${step.path}: berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, step.id, "add", pv.willChange)
  }

  if (lepas) {
    const c = await p.category.findFirst({ where: { path: lepas }, select: { id: true } })
    if (c) {
      const pv = await previewBulkAssignCategory(wooIds, c.id, "remove")
      console.log(`     - ${lepas}: berubah=${pv.willChange} tanpa_kategori=${pv.wouldBeLeftWithoutCategory} primary=${pv.primaryBeingRemoved}`)
      if (APPLY && pv.wouldBeLeftWithoutCategory > 0) throw new Error("Menghentikan: ada produk yang akan kehabisan kategori.")
      if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, c.id, "remove", pv.willChange)
    }
  }

  if (APPLY) {
    const daun = chain[chain.length - 1]
    for (const wooId of wooIds) await setPrimaryCategory(wooId, daun.id)
    console.log(`     * kategori utama: ${daun.path}`)
  }
  console.log()
}

console.log("=== KURANG DALAM (namanya menyebut sub-kategorinya) ===\n")
for (const [ids, tujuan, label] of DIPERDALAM) await jalankan(ids, tujuan, "", label)

console.log("=== SALAH POHON (dipindahkan ke cabang yang benar) ===\n")
for (const [ids, tujuan, lepas, label] of SALAH_POHON) await jalankan(ids, tujuan, lepas, label)

const total = [...DIPERDALAM, ...SALAH_POHON].reduce((n, x) => n + x[0].length, 0)
console.log(`${tag} selesai. Disentuh: ${total} produk.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
