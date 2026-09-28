/**
 * Memecah kategori datar `NETWORK TOOLS` (id 62) menjadi 10 sub-kategori.
 *
 * Kategori itu menampung 68 produk tanpa satu pun anak, padahal isinya jelas
 * berkelompok: switch, router, adapter, modem, dan seterusnya. Pengunjung yang
 * mencari "switch 8 port" harus memindai 68 baris campur aduk.
 *
 * Yang dikerjakan skrip ini, dalam satu transaksi:
 *
 *  1. Membuat 10 kategori anak di bawah id 62 (`depth` 2), dengan `path` dan
 *     `slug` mengikuti aturan yang sama persis dengan `createCategory()` di
 *     `src/lib/api/woocommerce/categories.ts` — path bergabung dengan " > ",
 *     slug diturunkan dari path penuh. Kalau aturan itu berubah, skrip ini
 *     ikut salah; ia sengaja tidak memanggil fungsi aslinya karena fungsi itu
 *     bertanda `server-only` dan memanggil `revalidatePath`.
 *  2. Memindahkan tautan 68 produk dari induk ke anak yang sesuai, sambil
 *     mempertahankan nilai `is_primary` yang lama.
 *
 * Induknya TIDAK dihapus dan tidak dikosongkan dari pohon — ia tetap jadi
 * simpul induk yang menaungi 10 anak itu.
 *
 *   # lihat rencananya, tidak menulis apa pun (bawaan)
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/subkategori-networking.mts
 *
 *   # benar-benar menulis
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/subkategori-networking.mts --tulis
 *
 * Bawaannya uji kering: yang paling mudah diketik adalah yang paling tidak
 * berbahaya. Sebelum menulis, skrip SELALU menyimpan berkas pemulihan di
 * `backup/` yang mengembalikan persis 68 tautan itu ke id 62 dan membuang 10
 * kategori baru — tanpa menyentuh kategori atau produk lain.
 *
 * Aman diulang: produk yang sudah pindah tidak lagi terhitung, dan kategori
 * yang sudah ada tidak dibuat dua kali.
 *
 * PEMETAANNYA DITULIS TANGAN, BUKAN DITEBAK SAAT JALAN. Pencocokan kata kunci
 * dipakai untuk MENYUSUN daftar di bawah, lalu hasilnya diperiksa satu per
 * satu dan tiga di antaranya dikoreksi (lihat catatan di `PETA`). Menjalankan
 * pencocokan itu lagi saat eksekusi berarti daftar yang sudah disetujui bisa
 * diam-diam berubah begitu ada produk baru masuk kategori 62.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { readFileSync, writeFileSync } from "node:fs"

const TULIS = process.argv.includes("--tulis")
const INDUK_ID = 62

const cocok = readFileSync(".env.local", "utf8").match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m)
if (!cocok) {
  console.error("DATABASE_URL tidak ada di .env.local")
  process.exit(1)
}
const url = new URL(cocok[1]!.replace(/^mysql:/, "http:"))
const namaDb = url.pathname.slice(1)

/**
 * Produk per sub-kategori, dalam urutan tampil yang diinginkan.
 *
 * Tiga koreksi manual atas hasil pencocokan kata kunci:
 *
 *  - 5363 Omada ER7206 tercocokkan ke "Switch & Hub" karena memuat kata
 *    GATEWAY. Ia sebenarnya router VPN, jadi dipindah ke Router.
 *  - 2223 TL-MR100 dan 2230 TL-MR105 barang sejenis (4G LTE router modem),
 *    tapi kata kunci melempar keduanya ke kelompok berbeda. Disamakan ke
 *    "Modem & MiFi" karena nilai jualnya kartu SIM, bukan LAN-nya.
 *  - 1720 UB500 adalah adapter Bluetooth murni tanpa Wi-Fi sama sekali.
 *    Ditaruh di "Adapter WiFi & Bluetooth" sebagai rumah terdekat, TAPI
 *    kemungkinan ia memang bukan barang networking — ditandai di keluaran
 *    skrip supaya staff meninjaunya, bukan diam-diam dipindahkan.
 */
const PETA: { nama: string; produk: number[] }[] = [
  {
    nama: "Switch & Hub",
    produk: [480, 481, 482, 1689, 2351, 2352, 2353, 3368, 3369, 3370, 3371, 3372, 5359, 5361, 5364],
  },
  {
    nama: "Adapter WiFi & Bluetooth",
    produk: [352, 353, 354, 641, 832, 1720, 2849, 2999, 3366, 4029, 5352, 5354, 5355, 5362],
  },
  {
    nama: "Router",
    produk: [551, 562, 1004, 1363, 1935, 3417, 4207, 5357, 5358, 5360, 5363],
  },
  { nama: "Access Point", produk: [2597, 3367, 5353, 5368, 5389] },
  { nama: "Range Extender & Mesh", produk: [973, 1364, 2420, 2521, 2659] },
  { nama: "Modem & MiFi", produk: [1878, 1879, 2223, 2230, 2239, 2357] },
  { nama: "Adapter Ethernet / LAN", produk: [2384, 3125, 5046, 5356, 5572] },
  { nama: "Konektor & Kabel LAN", produk: [2835, 4096, 4213, 4220] },
  { nama: "Internet Satelit", produk: [3793, 5091] },
  { nama: "Alat Jaringan", produk: [1600] },
]

/** Produk yang perlu ditinjau manusia setelah pemindahan, beserta alasannya. */
const DITANDAI: Record<number, string> = {
  1720: "Bluetooth murni tanpa Wi-Fi — mungkin bukan barang networking",
}

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()
const q = <T,>(s: string, ...p: unknown[]) => prisma.$queryRawUnsafe<T[]>(s, ...p)

console.log(`\nDatabase : ${namaDb} @ ${url.host}`)
console.log(`Mode     : ${TULIS ? "MENULIS" : "uji kering (tidak menulis apa pun)"}\n`)

// ------------------------------------------------------------------ periksa

const induk = (
  await q<{ id: number; name: string; path: string; depth: number }>(
    "SELECT id, name, path, depth FROM categories WHERE id = ?",
    INDUK_ID,
  )
)[0]
if (!induk) {
  console.error(`Kategori induk id ${INDUK_ID} tidak ada. Berhenti.`)
  process.exit(1)
}
console.log(`Induk    : "${induk.path}" (depth ${induk.depth})\n`)

/** Sama persis dengan slugFromPath() di src/lib/api/woocommerce/categories.ts */
const slugDariPath = (path: string) =>
  path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")

const rencana = PETA.map((k) => {
  const path = `${induk.path} > ${k.nama}`
  return { ...k, path, slug: slugDariPath(path) }
})

// Daftar produk yang benar-benar ada di induk sekarang.
const diInduk = await q<{ product_id: number; is_primary: number }>(
  "SELECT product_id, is_primary FROM product_categories WHERE category_id = ?",
  INDUK_ID,
)
const primaryPer = new Map(diInduk.map((r) => [Number(r.product_id), Number(r.is_primary)]))

// Konsistensi peta vs keadaan database.
const dipetakan = rencana.flatMap((k) => k.produk)
const ganda = dipetakan.filter((id, i) => dipetakan.indexOf(id) !== i)
const takAdaDiInduk = dipetakan.filter((id) => !primaryPer.has(id))
const tercecer = [...primaryPer.keys()].filter((id) => !dipetakan.includes(id))

console.log("=== Pemeriksaan peta ===")
console.log(`  produk di induk sekarang : ${primaryPer.size}`)
console.log(`  produk dipetakan         : ${dipetakan.length}`)
console.log(`  tercantum dua kali       : ${ganda.length}${ganda.length ? `  -> ${ganda.join(", ")}` : ""}`)
console.log(
  `  dipetakan tapi tak ada   : ${takAdaDiInduk.length}${takAdaDiInduk.length ? `  -> ${takAdaDiInduk.join(", ")}` : ""}`,
)
console.log(`  ada tapi tak dipetakan   : ${tercecer.length}${tercecer.length ? `  -> ${tercecer.join(", ")}` : ""}`)

if (ganda.length || takAdaDiInduk.length || tercecer.length) {
  console.error(
    "\nPeta tidak cocok dengan isi database. Perbaiki PETA di skrip ini dulu — " +
      "melanjutkan berarti ada produk yang hilang dari kategori atau tertaut dua kali.",
  )
  await prisma.$disconnect()
  process.exit(1)
}

// Kategori yang sudah ada dari jalan sebelumnya (skrip ini aman diulang).
const sudahAda = new Map(
  (
    await q<{ id: number; path: string }>(
      `SELECT id, path FROM categories WHERE path IN (${rencana.map(() => "?").join(",")})`,
      ...rencana.map((k) => k.path),
    )
  ).map((r) => [r.path, Number(r.id)]),
)

console.log("\n=== Rencana sub-kategori ===")
for (const k of rencana) {
  const tanda = sudahAda.has(k.path) ? "sudah ada" : "BARU"
  console.log(`  ${String(k.produk.length).padStart(2)} produk  ${k.nama.padEnd(26)} ${tanda.padEnd(9)} /${k.slug}`)
}

const perluDitandai = dipetakan.filter((id) => id in DITANDAI)
if (perluDitandai.length) {
  console.log("\n=== Perlu ditinjau staff setelah ini ===")
  for (const id of perluDitandai) console.log(`  produk ${id}: ${DITANDAI[id]}`)
}

if (!TULIS) {
  console.log("\nUji kering — tidak ada yang ditulis. Tambahkan --tulis untuk benar-benar menjalankan.")
  await prisma.$disconnect()
  process.exit(0)
}

// ------------------------------------------------------------------ menulis

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
const berkas = `backup/subkategori-networking-${stamp}.sql`
writeFileSync(
  berkas,
  `-- Pemulihan: mengembalikan 68 tautan produk ke kategori ${INDUK_ID} ("${induk.path}")\n` +
    `-- dan membuang sub-kategori yang dibuat pada ${stamp}.\n` +
    `-- Jalankan SELURUH berkas ini. Kategori dan produk lain tidak tersentuh.\n\n` +
    `START TRANSACTION;\n\n` +
    rencana
      .map(
        (k) =>
          `-- ${k.nama} (${k.produk.length} produk)\n` +
          `INSERT IGNORE INTO product_categories (product_id, category_id, is_primary)\n` +
          `  SELECT product_id, ${INDUK_ID}, is_primary FROM product_categories\n` +
          `  WHERE category_id = (SELECT id FROM categories WHERE path = '${k.path.replace(/'/g, "''")}');\n` +
          `DELETE FROM categories WHERE path = '${k.path.replace(/'/g, "''")}';`,
      )
      .join("\n\n") +
    `\n\nCOMMIT;\n`,
  "utf8",
)
console.log(`\nBerkas pemulihan: ${berkas}`)

let kategoriDibuat = 0
let tautanDipindah = 0

await prisma.$transaction(async (tx) => {
  for (const k of rencana) {
    let anakId = sudahAda.get(k.path)
    if (anakId === undefined) {
      await tx.$executeRawUnsafe(
        "INSERT INTO categories (name, slug, path, depth, parent_id) VALUES (?, ?, ?, ?, ?)",
        k.nama,
        k.slug,
        k.path,
        induk.depth + 1,
        INDUK_ID,
      )
      const baris = await tx.$queryRawUnsafe<{ id: number }[]>("SELECT id FROM categories WHERE path = ?", k.path)
      anakId = Number(baris[0]!.id)
      kategoriDibuat++
    }

    // Satu per satu, karena is_primary ikut berpindah apa adanya per produk.
    for (const pid of k.produk) {
      await tx.$executeRawUnsafe(
        "INSERT IGNORE INTO product_categories (product_id, category_id, is_primary) VALUES (?, ?, ?)",
        pid,
        anakId,
        primaryPer.get(pid) ?? 0,
      )
      tautanDipindah += await tx.$executeRawUnsafe(
        "DELETE FROM product_categories WHERE product_id = ? AND category_id = ?",
        pid,
        INDUK_ID,
      )
    }
  }
})

// ------------------------------------------------------------------ verifikasi

const sisaDiInduk = Number(
  (await q<{ n: bigint }>("SELECT COUNT(*) AS n FROM product_categories WHERE category_id = ?", INDUK_ID))[0]!.n,
)
const perAnak = await q<{ path: string; n: bigint }>(
  `SELECT c.path, COUNT(pc.product_id) AS n FROM categories c
   LEFT JOIN product_categories pc ON pc.category_id = c.id
   WHERE c.parent_id = ? GROUP BY c.id, c.path ORDER BY c.path`,
  INDUK_ID,
)
const totalAnak = perAnak.reduce((a, r) => a + Number(r.n), 0)

// Tidak boleh ada produk yang kehilangan seluruh kategorinya.
const yatim = Number(
  (
    await q<{ n: bigint }>(
      `SELECT COUNT(*) AS n FROM products p WHERE p.id IN (${dipetakan.map(() => "?").join(",")})
       AND NOT EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id)`,
      ...dipetakan,
    )
  )[0]!.n,
)

console.log("\n=== HASIL ===")
console.log(`  kategori dibuat      : ${kategoriDibuat}`)
console.log(`  tautan dipindah      : ${tautanDipindah}`)
console.log(`  sisa menempel induk  : ${sisaDiInduk}  (harus 0)`)
console.log(`  total di anak        : ${totalAnak}  (harus ${dipetakan.length})`)
console.log(`  produk tanpa kategori: ${yatim}  (harus 0)`)
console.log(`  hitungan cocok       : ${sisaDiInduk === 0 && totalAnak === dipetakan.length && yatim === 0 ? "ya" : "TIDAK — periksa!"}`)

console.log("\n=== Isi tiap sub-kategori ===")
for (const r of perAnak) console.log(`  ${String(Number(r.n)).padStart(2)}  ${r.path}`)

await prisma.$disconnect()
