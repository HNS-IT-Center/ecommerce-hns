/**
 * Migrasi #6 — bersihkan bentrok multi-akar yang memang sisa, bukan pilihan.
 *
 * Diaudit ulang terhadap taksonomi terbaru: 48 bentrok, dan komposisinya sudah
 * jauh berbeda dari 90 yang dulu. Bentrok charger terbesar sudah lenyap saat
 * CHARGER PHONE dilebur; yang tersisa di sana hanya jejak leluhurnya.
 *
 * Hanya dua kelompok yang disentuh:
 *
 * MEKANIS — produk memegang kaitan telanjang ke sebuah AKAR sementara rumah
 * sebenarnya ada di cabang lain yang lebih dalam. Kaitan akar itu tidak
 * menyatakan apa pun tentang produknya; ia sisa dari penempatan lama.
 *
 * REDUNDAN — charger yang dulu tinggal di CHARGER PHONE. Kategori itu sudah
 * dilebur ke POWERBANK & CHARGER, tapi kaitan ke bekas induknya
 * (TABLET & SMARTPHONE) ikut tertinggal.
 *
 * Yang punya alasan merchandising sah — barcode scanner yang memang scanner
 * DAN alat kasir, hardisk yang memang untuk PC ATAU CCTV, bundel meja yang
 * memang berisi bracket monitor — sengaja dibiarkan. Menghapus relasi yang
 * masih berfungsi lebih merugikan daripada menyisakan angka bentrok.
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

/** Kaitan akar telanjang yang tidak menyatakan apa pun tentang produknya. */
const MEKANIS: Array<[number[], string, string]> = [
  [[7389, 7395, 8353, 8359, 8365, 8367, 8385, 8450], "AKSESSORIES KOMPUTER",
    "tinta & cartridge — rumahnya PRINTER & PROYEKTOR > TINTA"],
  [[24695, 31101], "KOMPONEN PC / NB", "printer — rumahnya PRINTER & PROYEKTOR"],
  [[27580, 22051], "KOMPONEN PC / NB", "laptop — rumahnya LAPTOP & PC > LAPTOP OFFICE"],
  [[17206], "KOMPONEN PC / NB", "travel adapter — rumahnya POWERBANK & CHARGER"],
  [[31339], "KOMPONEN PC / NB", "USB hub — rumahnya KABEL / CONVERTER > USB HUB"],
  [[11741], "AKSESSORIES KOMPUTER", "TP-LINK UE330 — rumahnya NETWORK TOOLS"],
]

/** Jejak leluhur dari CHARGER PHONE yang sudah dilebur. */
const REDUNDAN: number[] = [
  26925, 29923, 29977, 30094, 30107, 30116, 30677, 30822, 30833, 30839, 30848,
]

/**
 * Koreksi kesalahan migrasi #5C: PC rakitan HNS ini ikut terbawa ke daftar VGA
 * dan terarsip sebagai kartu grafis NVIDIA — padahal GPU-nya AMD RX 9070 XT,
 * dan barangnya sendiri PC utuh, bukan kartu grafis.
 */
const KOREKSI_VGA = {
  wooId: 24184,
  lepas: [
    "KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD > VGA NVIDIA",
    "KOMPONEN PC / NB > VGA CARD / GRAPHICS CARD",
    "KOMPONEN PC / NB",
  ],
  utama: "LAPTOP & PC > PC MINI & DESKTOP",
}

console.log(`${tag} Bersihkan bentrok multi-akar yang memang sisa\n`)

async function lepas(wooIds: number[], path: string, label: string) {
  const c = await p.category.findFirst({ where: { path }, select: { id: true } })
  if (!c) { console.log(`   ? kategori hilang: ${path}`); return }
  const pv = await previewBulkAssignCategory(wooIds, c.id, "remove")
  console.log(`   - ${path}: berubah=${pv.willChange} tanpa_kategori=${pv.wouldBeLeftWithoutCategory} primary=${pv.primaryBeingRemoved}  [${label}]`)
  if (APPLY && pv.wouldBeLeftWithoutCategory > 0) {
    throw new Error("Menghentikan: ada produk yang akan kehabisan kategori.")
  }
  if (APPLY && pv.willChange > 0) await bulkAssignCategory(wooIds, c.id, "remove", pv.willChange)
}

console.log("=== MEKANIS — kaitan akar telanjang ===")
for (const [ids, path, label] of MEKANIS) await lepas(ids, path, label)

console.log("\n=== REDUNDAN — jejak CHARGER PHONE yang sudah dilebur ===")
await lepas(REDUNDAN, "LAPTOP & PC > TABLET & SMARTPHONE", "charger, bukan tablet/ponsel")
await lepas(REDUNDAN, "LAPTOP & PC", "leluhur yang ikut tertinggal")

console.log("\n=== KOREKSI KESALAHAN #5C ===")
for (const path of KOREKSI_VGA.lepas) await lepas([KOREKSI_VGA.wooId], path, "PC rakitan, bukan kartu grafis")
if (APPLY) {
  const utama = await p.category.findFirst({ where: { path: KOREKSI_VGA.utama }, select: { id: true } })
  await setPrimaryCategory(KOREKSI_VGA.wooId, utama!.id)
  console.log(`   * kategori utama dikembalikan ke ${KOREKSI_VGA.utama}`)
}

console.log(`\n${tag} selesai.`)
if (!APPLY) console.log("Jalankan ulang dengan --apply untuk menerapkan.")

await p.$disconnect()
