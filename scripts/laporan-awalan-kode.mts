/**
 * Laporan awalan kode Accurate — BACA SAJA, tidak menulis apa pun.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/laporan-awalan-kode.mts
 *
 * Menguji ulang aturan yang tertulis di `prisma/schema.prisma` pada kolom
 * `accurateCode`: "kalau satu produk punya padanan berawalan 1 dan 2, yang
 * dipakai berawalan 2 — awalan 1 skema lama yang 71% isinya sudah tidak aktif".
 *
 * Angka 71% itu diukur 8 September 2026. Skrip ini mengukurnya lagi, dan
 * sekalian menjawab pertanyaan yang sebenarnya dipakai untuk memilih urutan
 * kerja: berapa sisa antrean per awalan, dan berapa yang benar-benar aktif.
 *
 * Catatan `STATUS`: kolom itu menjawab "sudah dihentikan?", jadi **YA berarti
 * TIDAK aktif** — kebalikan dari bacaan pertama orang. Lihat `labelStatus()`
 * di tabel-harga-view.tsx.
 *
 * Satu sambungan untuk seluruh laporan: batas koneksi Hostinger 500/jam, dan
 * skrip beruntun pernah menghabiskannya.
 */
import { readFileSync } from "node:fs"

const isiEnv = readFileSync(".env.local", "utf8")
for (const baris of isiEnv.split(/\r?\n/)) {
  const m = baris.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (!m) continue
  process.env[m[1]!] ??= m[2]!.trim().replace(/^["']|["']$/g, "")
}

const { getPrisma } = await import("../src/lib/prisma/client.ts")
const prisma = getPrisma()

const n = (v: unknown) => Number(v ?? 0)
const persen = (bagian: number, dari: number) =>
  dari === 0 ? "—" : `${((bagian / dari) * 100).toFixed(1)}%`

try {
  const perAwalan = await prisma.$queryRawUnsafe<
    { awalan: string; total: bigint; tidakAktif: bigint; tertaut: bigint; diabaikan: bigint }[]
  >(
    `SELECT LEFT(a.\`Kode Accurate\`, 1) AS awalan,
            COUNT(*)                                            AS total,
            SUM(a.\`STATUS\` = 'YA')                            AS tidakAktif,
            SUM(p.woo_id IS NOT NULL)                           AS tertaut,
            SUM(ig.kode_accurate IS NOT NULL)                   AS diabaikan
       FROM accurate_products a
       LEFT JOIN products p         ON p.accurate_code = a.\`Kode Accurate\`
       LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
      GROUP BY LEFT(a.\`Kode Accurate\`, 1)
      ORDER BY total DESC`,
  )

  console.log("\nSeluruh barang Accurate menurut awalan kode")
  console.log("awalan |   total | tidak aktif      | tertaut | diabaikan")
  console.log("-------|---------|------------------|---------|----------")
  for (const r of perAwalan) {
    const total = n(r.total)
    console.log(
      `   ${r.awalan}   | ${String(total).padStart(7)} | ` +
        `${String(n(r.tidakAktif)).padStart(6)} (${persen(n(r.tidakAktif), total).padStart(6)}) | ` +
        `${String(n(r.tertaut)).padStart(7)} | ${String(n(r.diabaikan)).padStart(9)}`,
    )
  }

  // Antrean kerja yang sesungguhnya: aktif, belum tertaut, belum diabaikan.
  const antrean = await prisma.$queryRawUnsafe<{ awalan: string; sisa: bigint }[]>(
    `SELECT LEFT(a.\`Kode Accurate\`, 1) AS awalan, COUNT(*) AS sisa
       FROM accurate_products a
       LEFT JOIN products p          ON p.accurate_code = a.\`Kode Accurate\`
       LEFT JOIN accurate_ignored ig ON ig.kode_accurate = a.\`Kode Accurate\`
      WHERE p.woo_id IS NULL
        AND ig.kode_accurate IS NULL
        AND (a.\`STATUS\` IS NULL OR a.\`STATUS\` <> 'YA')
      GROUP BY LEFT(a.\`Kode Accurate\`, 1)
      ORDER BY sisa DESC`,
  )

  console.log("\nAntrean penautan (aktif, belum tertaut, belum diabaikan)")
  for (const r of antrean) {
    console.log(`  awalan ${r.awalan} : ${n(r.sisa).toLocaleString("id-ID")}`)
  }
  console.log(
    `  TOTAL      : ${antrean.reduce((t, r) => t + n(r.sisa), 0).toLocaleString("id-ID")}`,
  )

  /**
   * Inti aturan di schema.prisma: barang yang SAMA muncul dua kali, sekali
   * berawalan 1 dan sekali berawalan 2. Dicocokkan lewat nama persis — satu
   * -satunya penanda yang dimiliki kedua baris.
   */
  const kembar = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM (
       SELECT a1.\`NAMA BARANG\` AS nama
         FROM accurate_products a1
         JOIN accurate_products a2 ON a2.\`NAMA BARANG\` = a1.\`NAMA BARANG\`
        WHERE a1.\`Kode Accurate\` LIKE '1%' AND a2.\`Kode Accurate\` LIKE '2%'
          AND a1.\`NAMA BARANG\` IS NOT NULL AND a1.\`NAMA BARANG\` <> ''
        GROUP BY a1.\`NAMA BARANG\`
     ) x`,
  )
  console.log(
    `\nBarang bernama sama yang punya padanan awalan 1 DAN 2: ${n(kembar[0]?.n).toLocaleString("id-ID")}`,
  )

  // Produk web yang tertaut ke kode awalan 1 — kalau padanan awalan 2-nya ada,
  // inilah tautan yang menurut aturan skema menambat ke baris yang keliru.
  const tertautKe1 = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    "SELECT COUNT(*) AS n FROM products WHERE accurate_code LIKE '1%'",
  )
  console.log(
    `Produk web yang tertaut ke kode awalan 1 : ${n(tertautKe1[0]?.n).toLocaleString("id-ID")}`,
  )
} finally {
  await prisma.$disconnect()
}
