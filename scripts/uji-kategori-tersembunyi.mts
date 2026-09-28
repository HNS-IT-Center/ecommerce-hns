/**
 * Memastikan "Jasa Rakit" hilang dari dropdown KATEGORI di header TANPA
 * mematahkan PC Builder, yang memakai kategori itu sebagai step wajib.
 *
 * LINGKUPNYA SENGAJA SEMPIT. Yang disembunyikan HANYA menu header; filter
 * /shop, /search, sitemap, dan halaman produknya tetap menampilkannya apa
 * adanya. Karena itu penyaringnya ada di `src/components/layout/header.tsx`,
 * bukan di `getCategories` — menaruhnya di lapisan data akan ikut
 * menghilangkannya dari keempat tempat itu sekaligus.
 *
 * Dua sisi harus diuji bersama. Menyembunyikan kategori memang mudah; yang
 * berbahaya adalah menyembunyikannya sampai step `isRequired: true` di
 * `PC_BUILDER_CONFIG` kehabisan produk dan seluruh alur rakit PC mandek —
 * kegagalan yang tidak terlihat dari halaman mana pun sampai ada pelanggan
 * yang mencoba merakit.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-kategori-tersembunyi.mts
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const SLUG = "laptop-pc-jasa-rakit"
const KATEGORI_ID = 179

const { hideEmptyWhere } = await import("../src/lib/api/woocommerce/categories")
const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

console.log(`\nDatabase : ${new URL(process.env.DATABASE_URL!.replace(/^mysql:/, "http:")).host}\n`)

const gagal: string[] = []
const lolos: string[] = []

// --- 1. Kategorinya masih ADA di database (jangan sampai terhapus) --------

const kat = await prisma.category.findUnique({ where: { id: KATEGORI_ID } })
if (kat) lolos.push(`kategori ${KATEGORI_ID} "${kat.name}" masih ada (slug: ${kat.slug})`)
else gagal.push(`kategori ${KATEGORI_ID} HILANG dari database — step wajib PC Builder putus`)

// --- 2. Produk di dalamnya masih terjangkau ------------------------------

const produk = await prisma.productCategory.findMany({
  where: { categoryId: KATEGORI_ID },
  include: { product: { select: { id: true, name: true, status: true } } },
})
if (produk.length > 0) {
  lolos.push(`${produk.length} produk masih tertaut: ${produk.map((p) => p.product.name).join(", ")}`)
  const takTerbit = produk.filter((p) => p.product.status !== "PUBLISHED")
  if (takTerbit.length) {
    gagal.push(`${takTerbit.length} produk TIDAK published — builder kemungkinan menyaringnya`)
  }
} else {
  gagal.push("tidak ada produk di kategori itu — step wajib PC Builder tidak punya pilihan")
}

// --- 3. Lapisan data TIDAK boleh menyaring ------------------------------
//
// Penyaringnya ada di header saja. Kalau `getCategories` ikut membuangnya,
// /shop dan /search kehilangan filter itu juga — di luar yang diminta.

const dariLapisanData = await prisma.category.findMany({
  where: hideEmptyWhere(),
  take: 500,
  select: { id: true, slug: true, name: true },
})
if (dariLapisanData.some((c) => c.slug === SLUG)) {
  lolos.push("lapisan data TETAP mengembalikannya (dipakai /shop & /search)")
} else {
  gagal.push("lapisan data ikut menyaring — /shop & /search kehilangan filternya")
}

// --- 4. Header: penyaringnya ada dan menyasar slug yang benar -----------

const header = await import("node:fs").then((fs) =>
  fs.readFileSync("src/components/layout/header.tsx", "utf8"),
)
if (!header.includes("SLUG_TERSEMBUNYI_DI_MENU")) {
  gagal.push("header.tsx tidak punya penyaring menu")
} else if (!header.includes(SLUG)) {
  gagal.push(`penyaring di header tidak menyebut "${SLUG}"`)
} else if (!header.includes("categories={categoriesMenu}")) {
  gagal.push("MegaMenu masih menerima daftar yang belum disaring")
} else {
  lolos.push("header menyaringnya sebelum diserahkan ke MegaMenu")
}

// Induknya (LAPTOP & PC) harus tetap tampil dengan anak-anaknya yang lain.
const induk = dariLapisanData.find((c) => c.id === 1)
const saudara = await prisma.category.count({ where: { parentId: 1, slug: { not: SLUG } } })
if (induk) lolos.push(`induk "LAPTOP & PC" tetap tampil dengan ${saudara} anak lain`)
else gagal.push('induk "LAPTOP & PC" ikut hilang')

// --- 5. PC Builder: step wajibnya masih punya produk ---------------------

// Kolom `value` bertipe JSON di MariaDB, jadi driver mengembalikannya sudah
// sebagai objek — JSON.parse() atasnya justru melempar "[object Object]".
const setting = await prisma.$queryRawUnsafe<{ value: unknown }[]>(
  "SELECT `value` FROM settings WHERE `key` = 'PC_BUILDER_CONFIG'",
)
if (setting[0]) {
  type Step = { id: string; name: string; categoryIds?: number[]; isRequired?: boolean }
  const mentah = setting[0].value
  const steps: Step[] = (typeof mentah === "string" ? JSON.parse(mentah) : mentah) as Step[]

  for (const step of steps) {
    const ids = step.categoryIds ?? []
    if (ids.length === 0) continue

    // Meniru pemekaran keturunan di src/features/builder/actions.ts
    const terpilih = await prisma.category.findMany({ where: { id: { in: ids } }, select: { path: true } })
    const keturunan = await prisma.category.findMany({
      where: { OR: terpilih.map((c) => ({ path: { startsWith: c.path } })) },
      select: { id: true },
    })
    const jml = await prisma.productCategory.count({
      where: { categoryId: { in: keturunan.map((c) => c.id) } },
    })

    const wajib = step.isRequired ? " [WAJIB]" : ""
    if (jml === 0) gagal.push(`step "${step.name}"${wajib} nol produk — builder mandek`)
    else if (step.isRequired || ids.includes(KATEGORI_ID) || ids.includes(62)) {
      lolos.push(`step "${step.name}"${wajib} menjangkau ${jml} produk`)
    }
  }
} else {
  gagal.push("PC_BUILDER_CONFIG tidak ditemukan di settings")
}

// ------------------------------------------------------------------ hasil

console.log("=== LOLOS ===")
for (const l of lolos) console.log(`  OK   ${l}`)
if (gagal.length) {
  console.log("\n=== GAGAL ===")
  for (const g of gagal) console.log(`  X    ${g}`)
}

console.log(`\n=== ${gagal.length === 0 ? "SEMUA LOLOS" : `${gagal.length} GAGAL`} ===`)

await prisma.$disconnect()
process.exit(gagal.length === 0 ? 0 : 1)
