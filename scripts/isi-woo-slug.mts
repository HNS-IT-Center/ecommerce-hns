/**
 * Mengisi kolom `products.woo_slug` — peta 301 redirect untuk cutover.
 *
 * Alamat produk di WooCommerce dan di store berbeda pada 1.016 produk. Slug
 * store yang lebih benar dipertahankan; slug lama disimpan di `woo_slug` supaya
 * alamat yang sudah beredar (hasil pencarian Google, tautan yang dibagikan,
 * bookmark) tetap mendarat di produk yang tepat lewat 301.
 *
 * IDEMPOTEN. Menjalankannya berkali-kali menghasilkan keadaan yang sama, jadi
 * aman diulang. Jalankan sekali sekarang untuk mengisi, lalu SEKALI LAGI di
 * pagi 13 September sebelum DNS dialihkan — yang kedua menangkap produk yang
 * dibuat setelah hari ini.
 *
 * Pemakaian:
 *   npx tsx scripts/isi-woo-slug.mts --dry-run   # lihat rencananya, tanpa menulis
 *   npx tsx scripts/isi-woo-slug.mts             # terapkan
 *
 * Setelah 13 September situs lama pindah ke `old.hnsitcenter.id`; selama ia
 * masih hidup (2-4 minggu) skrip ini tetap bisa dijalankan dengan menyesuaikan
 * WOOCOMMERCE_URL. Setelah itu tidak ada lagi sumber slug lama — peta yang
 * sudah tersimpan di database menjadi satu-satunya salinan.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { getPrisma } = await import("../src/lib/prisma/client")
const { fetchRemoteProducts } = await import("../src/lib/api/woocommerce/sync/remote")

const DRY_RUN = process.argv.includes("--dry-run")

/**
 * Berapa baris diperbarui dalam satu transaksi.
 *
 * Kolam koneksi ke Hostinger dibatasi 1-3 (lihat src/lib/prisma/client.ts) dan
 * kuota `max_connections_per_hour` 500 sudah pernah habis. Batch dijalankan
 * berurutan, bukan dengan Promise.all — beberapa ratus UPDATE paralel di sini
 * akan menghabiskan jatah koneksi dan menjatuhkan storefront bersamanya.
 *
 * 50 TERBUKTI TERLALU BESAR: dua batch melewati batas transaksi bawaan Prisma
 * (5 detik) pada percobaan pertama, karena latensi ke Hostinger membuat satu
 * UPDATE menghabiskan ~100ms dan 50 di antaranya menembus batas. Diturunkan ke
 * 20, dan batas waktunya dinaikkan supaya lonjakan latensi tidak langsung
 * menggagalkan seluruh batch.
 */
const BATCH = 20

/**
 * Batas waktu satu transaksi. Bawaan Prisma 5 detik; dinaikkan karena batas itu
 * diukur dari koneksi lokal, bukan dari server yang jaraknya belasan ribu
 * kilometer.
 */
const TX_TIMEOUT_MS = 30000

const prisma = getPrisma()

console.log(DRY_RUN ? "MODE: DRY-RUN (tidak menulis apa pun)\n" : "MODE: TERAPKAN\n")

// --- 1. Tarik katalog WooCommerce ------------------------------------------
console.log("Menarik katalog dari WooCommerce...")
const remote = await fetchRemoteProducts()
console.log(
  "  " +
    remote.products.length +
    " produk (" +
    remote.pagesFetched +
    " halaman, dilaporkan " +
    remote.reportedTotal +
    ")",
)
if (remote.truncated) {
  console.error("  PERINGATAN: hasil terpotong di batas MAX_PAGES — peta tidak lengkap.")
}

/**
 * Hanya produk yang PUNYA alamat publik yang perlu dijembatani.
 *
 * `draft` tidak pernah terbit — 25 produk bracket TV di katalog ini slug-nya
 * bahkan kosong. `private` hanya terlihat oleh yang sudah login. Keduanya tidak
 * pernah di-crawl dan tidak punya tautan beredar, jadi tidak ada alamat yang
 * perlu diselamatkan.
 */
const publik = remote.products.filter(
  (p) => p.status === "publish" && typeof p.slug === "string" && p.slug.trim() !== "",
)
console.log("  " + publik.length + " di antaranya publish dengan slug terisi")

// --- 2. Ambil keadaan store -------------------------------------------------
const lokal = await prisma.product.findMany({
  select: { id: true, wooId: true, slug: true, wooSlug: true, name: true },
})
const byWooId = new Map(lokal.map((l) => [l.wooId, l]))
console.log("  " + lokal.length + " produk di store\n")

// --- 3. Tentukan apa yang perlu berubah ------------------------------------
type Rencana = { id: number; wooId: number; dari: string | null; ke: string | null; nama: string }

const perluIsi: Rencana[] = []
const perluUbah: Rencana[] = []
const perluKosongkan: Rencana[] = []
let sudahBenar = 0
let tidakAdaDiStore = 0

for (const r of publik) {
  const l = byWooId.get(r.id)
  if (l === undefined) {
    tidakAdaDiStore++
    continue
  }

  /**
   * Slug Woo disimpan TER-DECODE.
   *
   * WooCommerce menuliskan simbol inci sebagai persen-encoding
   * (`%e2%80%b3` = `″`) pada 158 slug. Next.js sudah men-decode parameter rute
   * sebelum handler melihatnya, jadi menyimpan bentuk ter-encode berarti
   * pencocokannya tidak akan pernah kena.
   */
  let wooSlugDecoded: string
  try {
    wooSlugDecoded = decodeURIComponent(r.slug)
  } catch {
    // Persen-encoding cacat — pakai apa adanya, lebih baik daripada melewatkan
    // produknya sama sekali.
    wooSlugDecoded = r.slug
  }

  // Slug sudah identik: tidak ada alamat lama yang berbeda untuk dijembatani.
  //
  // Tetap disimpan, tidak dilewati. Slug store bisa diubah staff kapan saja —
  // begitu itu terjadi, alamat lama yang tadinya identik ikut mati, dan tanpa
  // catatan ini tidak ada yang bisa menyelamatkannya. Biaya menyimpannya nol.
  const target = wooSlugDecoded

  if (l.wooSlug === target) {
    sudahBenar++
    continue
  }

  const rencana: Rencana = {
    id: l.id,
    wooId: l.wooId,
    dari: l.wooSlug,
    ke: target,
    nama: l.name,
  }
  if (l.wooSlug === null) perluIsi.push(rencana)
  else perluUbah.push(rencana)
}

// Produk yang TIDAK lagi publish di Woo tapi masih menyimpan woo_slug.
// Dibiarkan: alamat lamanya mungkin masih ada di indeks Google, dan redirect
// yang tetap bekerja lebih baik daripada 404. Dicatat saja supaya terlihat.
const wooPublikIds = new Set(publik.map((p) => p.id))
const yatimPiatu = lokal.filter((l) => l.wooSlug !== null && !wooPublikIds.has(l.wooId))

console.log("=".repeat(70))
console.log("RENCANA")
console.log("=".repeat(70))
console.log("  Sudah benar, dilewati : " + sudahBenar)
console.log("  Akan DIISI (kosong)   : " + perluIsi.length)
console.log("  Akan DIUBAH (beda)    : " + perluUbah.length)
console.log("  Ada di Woo, bukan store: " + tidakAdaDiStore)
console.log("  Punya woo_slug tapi tidak lagi publish di Woo: " + yatimPiatu.length + " (dibiarkan)")

// Berapa yang benar-benar akan menghasilkan redirect (slug berbeda).
const akanRedirect = [...perluIsi, ...perluUbah].filter((r) => {
  const l = lokal.find((x) => x.id === r.id)
  return l !== undefined && l.slug !== r.ke
}).length
console.log("\n  Dari yang ditulis, menghasilkan redirect nyata: " + akanRedirect)
console.log("  (sisanya slug-nya memang sudah sama — disimpan sebagai jaring)")

if (perluUbah.length > 0) {
  console.log("\n=== CONTOH PERUBAHAN NILAI LAMA (maks 10) ===")
  for (const r of perluUbah.slice(0, 10)) {
    console.log("\n  wooId=" + r.wooId + "  " + r.nama.slice(0, 54))
    console.log("    dari : " + r.dari)
    console.log("    ke   : " + r.ke)
  }
}

if (perluIsi.length > 0) {
  console.log("\n=== CONTOH PENGISIAN BARU (maks 5) ===")
  for (const r of perluIsi.slice(0, 5)) {
    console.log("  wooId=" + r.wooId + "  ke=" + String(r.ke).slice(0, 58))
  }
}

// --- 4. Terapkan ------------------------------------------------------------
const semua = [...perluIsi, ...perluUbah]

if (DRY_RUN) {
  console.log("\nDRY-RUN: tidak ada yang ditulis. Jalankan tanpa --dry-run untuk menerapkan.")
  await prisma.$disconnect()
  process.exit(0)
}

if (semua.length === 0) {
  console.log("\nTidak ada yang perlu diubah. Selesai.")
  await prisma.$disconnect()
  process.exit(0)
}

console.log("\nMenulis " + semua.length + " baris (batch " + BATCH + ", berurutan)...")
let ditulis = 0
let gagal = 0

for (let i = 0; i < semua.length; i += BATCH) {
  const chunk = semua.slice(i, i + BATCH)
  try {
    await prisma.$transaction(
      chunk.map((r) =>
        prisma.product.update({
          where: { id: r.id },
          data: { wooSlug: r.ke },
        }),
      ),
      { timeout: TX_TIMEOUT_MS },
    )
    ditulis += chunk.length
  } catch (error) {
    gagal += chunk.length
    console.error(
      "  batch " + (i / BATCH + 1) + " GAGAL (" + chunk.length + " baris): ",
      error instanceof Error ? error.message : error,
    )
  }
  process.stdout.write("  " + Math.min(i + BATCH, semua.length) + "/" + semua.length + "\r")
}

console.log("\n\nSelesai. Berhasil: " + ditulis + "   Gagal: " + gagal)

// --- 5. Verifikasi dari database, bukan dari hitungan di memori -------------
const terisi = await prisma.product.count({ where: { wooSlug: { not: null } } })
console.log("Baris dengan woo_slug terisi (dibaca ulang dari DB): " + terisi)

if (gagal > 0) {
  console.error("\nAda batch yang gagal — jalankan ulang skrip ini; ia idempoten.")
  await prisma.$disconnect()
  process.exit(1)
}

await prisma.$disconnect()
