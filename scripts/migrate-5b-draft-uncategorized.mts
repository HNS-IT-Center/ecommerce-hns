/**
 * Migrasi #5B — beri kategori pada produk draft/private yang sudah jelas.
 *
 * Aturan user (29 Juli 2026): draft/private yang memang belum layak terbit
 * boleh tetap tanpa kategori; yang dikerjakan hanya produk yang SECARA DATA
 * sudah jelas; dan jangan mengejar angka nol dengan menebak.
 *
 * Yang menentukan di sini adalah kejelasan JENIS BARANG, bukan kelengkapan
 * listing. Sebuah RAM DDR4 tetap RAM meski fotonya belum diunggah, dan
 * memberinya kategori sekarang berarti ia langsung bisa ditemukan begitu
 * diterbitkan, bukan menunggu penyisiran berikutnya.
 *
 * Bagian terbesarnya PC rakitan HNS sendiri. Kategori PC MINI & DESKTOP sudah
 * berisi PC rakitan bermerek (MSI MAG INFINITE, ASUS TUF T500MV), jadi
 * menempatkannya di sana bukan tebakan melainkan rak yang memang sudah ada
 * isinya sejenis. Apakah PC rakitan HNS layak punya rak sendiri adalah
 * pertanyaan merchandising, dan itu dicatat sebagai keputusan terpisah —
 * memindahkannya nanti cukup satu operasi.
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

const PC = "LAPTOP & PC > PC MINI & DESKTOP"

/** PC rakitan HNS — seluruhnya desktop, namanya menyebutkan sendiri. */
const PC_RAKITAN = [
  20053, 20102, 20113, 22797, 14031, 11763, 14034, 14035, 14020,
  24136, 24132, 24138, 24182, 24171, 24183, 24702, 24878, 24131,
  24139, 24133, 24157, 24137, 24185, 24168, 24184, 23689, 23706,
  23727, 25791, 25793, 26122, 26086, 12772, 14209, 13989,
  12781, // PC RAKITAN HIGH END INTEL ULTRA 5 245KF
]

/** Komponen & aksesori yang jenisnya disebut telanjang di namanya. */
const SATUAN: Array<[number, string, string]> = [
  [19946, "AKSESSORIES KOMPUTER > KABEL / CONVERTER > KABEL LIGHTNING", "Baseus Type-C to Lightning"],
  [3892, "KOMPONEN PC / NB > RAM / MEMORY > RAM PC DDR 4", "RAM PC DDR4 DIGITAL ALLIANCE 8GB"],
  [11048, "KOMPONEN PC / NB > SSD / NVME > M.2 / NVME", "SSD NVME KINGSTON NV2"],
  [11310, "KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > VGA NVIDIA", "VGA MSI RTX 4080 SUPER (chipset NVIDIA)"],
]

/** Jenis barangnya tidak terbaca dari nama — jangan dipaksakan. */
const PERLU_PIC: Array<[number, string]> = [
  [14036, "HNS OFFICE BLUE MAGIC PRO II 1270 — tanpa gambar, nama tidak menyebut jenis barang"],
  [14022, "HNS OFFICE RED MAGIC 320G — tanpa gambar, nama tidak menyebut jenis barang"],
]

console.log(`${tag} Kategorikan produk draft/private yang sudah jelas\n`)

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

async function tempatkan(label: string, wooIds: number[], path: string) {
  console.log(`${label} -> ${path}  (${wooIds.length} produk)`)
  const chain = await chainOf(path)
  for (const step of chain) {
    const pv = await previewBulkAssignCategory(wooIds, step.id, "add")
    console.log(`     + ${step.path}: berubah=${pv.willChange} sudah=${pv.alreadyDone}`)
    if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, step.id, "add", pv.willChange)
  }
  if (APPLY) {
    const daun = chain[chain.length - 1]
    for (const wooId of wooIds) await setPrimaryCategory(wooId, daun.id)
    console.log(`     * kategori utama: ${daun.path}`)
  }
  console.log()
}

await tempatkan("PC rakitan HNS", PC_RAKITAN, PC)

for (const [wooId, path, label] of SATUAN) {
  await tempatkan(label, [wooId], path)
}

console.log("=== PERLU KEPUTUSAN PIC (tidak disentuh) ===")
for (const [wooId, alasan] of PERLU_PIC) console.log(`  wooId=${wooId} — ${alasan}`)

console.log(`\n${tag} selesai. Ditempatkan: ${PC_RAKITAN.length + SATUAN.length}. Ditahan: ${PERLU_PIC.length}.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
