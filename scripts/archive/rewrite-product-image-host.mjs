// Pindahkan host gambar produk dari WordPress ke host media sendiri.
//
//   https://hnsitcenter.id/wp-content/uploads/2026/08/x.webp
//   -> https://media.hnsitcenter.com/2026/08/x.webp
//
// Dijalankan sekali pada 29 Agustus 2026 terhadap 875 baris `product_images`
// milik 170 produk hasil import WooCommerce. Sesudahnya seluruh 13.707 gambar
// berada di satu host.
//
// KENAPA PEMETAANNYA BEGITU: host media memangkas `/wp-content/uploads`.
// Bentuk itu bukan tebakan — ia mengikuti 12.832 baris yang sudah ada sejak
// import katalog pertama (`https://media.hnsitcenter.com/2024/09/Acer-...png`).
//
// YANG PERLU DIKETAHUI SEBELUM MENJALANKAN ULANG: saat skrip ini dipakai,
// berkas unggahan 2026/08 ke atas BELUM ada di host media dan menjawab 404,
// sementara URL WordPress aslinya menjawab 200. Pemindahan berkasnya sendiri
// pekerjaan terpisah di luar aplikasi ini. Keputusannya diambil sadar: lebih
// baik katalog menunjuk satu host dan menunggu berkasnya menyusul, daripada
// bercabang jadi dua host yang harus dijaga selamanya.
//
// Pemakaian:
//   node scripts/archive/rewrite-product-image-host.mjs            # dry-run
//   node scripts/archive/rewrite-product-image-host.mjs --apply
//
// Membalikkan: cadangan baris sebelum perubahan ada di berkas JSON yang dibuat
// terpisah saat itu; kalau tidak ada, tukar saja LAMA dan BARU di bawah —
// pemetaannya dua arah selama pola pathnya tetap.
import mariadb from "mariadb"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const LAMA = "https://hnsitcenter.id/wp-content/uploads/"
const BARU = "https://media.hnsitcenter.com/"
const APPLY = process.argv.includes("--apply")

const url = new URL(process.env.DATABASE_URL.replace(/^['"]|['"]$/g, ""))
const conn = await mariadb.createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  connectTimeout: 20000,
})

const rows = await conn.query("SELECT id, url FROM product_images WHERE url LIKE ?", [LAMA + "%"])
console.log(`${APPLY ? "TERAPKAN" : "DRY-RUN"} — ${rows.length} baris`)
for (const row of rows.slice(0, 3)) {
  console.log(`  ${row.url}\n  -> ${BARU + row.url.slice(LAMA.length)}\n`)
}

// Penjagaan: kalau ada baris yang tidak berpola, berhenti sepenuhnya alih-alih
// memindahkan sebagian. Baris yang bentuknya di luar dugaan lebih baik
// diperiksa manusia daripada ditebak.
const menyimpang = rows.filter((row) => !row.url.startsWith(LAMA))
if (menyimpang.length > 0) {
  console.error(`BERHENTI: ${menyimpang.length} baris tidak berpola.`)
  await conn.end()
  process.exit(1)
}

if (!APPLY) {
  console.log("(tidak ada yang diubah — jalankan dengan --apply)")
  await conn.end()
  process.exit(0)
}

await conn.beginTransaction()
try {
  const hasil = await conn.query(
    "UPDATE product_images SET url = CONCAT(?, SUBSTRING(url, ?)) WHERE url LIKE ?",
    [BARU, LAMA.length + 1, LAMA + "%"],
  )
  await conn.commit()
  console.log(`baris diubah: ${Number(hasil.affectedRows)}`)
} catch (error) {
  await conn.rollback()
  console.error("ROLLBACK:", error.message)
  await conn.end()
  process.exit(1)
}

console.log("\nsebaran host sesudahnya:")
for (const row of await conn.query(
  "SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(url,'/',3),'/',-1) h, COUNT(*) c FROM product_images GROUP BY h ORDER BY c DESC",
)) {
  console.log(`  ${String(row.h).padEnd(24)} ${Number(row.c)}`)
}

await conn.end()
