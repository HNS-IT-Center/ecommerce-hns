/**
 * Verifikasi `periksaKode` — BACA SAJA, tidak menulis apa pun.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-periksa-kode.mts
 *
 * Menguji fungsi SUNGGUHAN dari `lib/api/accurate/price-table.ts`, bukan salinan
 * SQL-nya. Karena tidak ada satu pun perintah tulis di sini, menjalankannya
 * terhadap database yang sedang terpasang aman.
 *
 * Tiga cabang di dalam fungsinya, tiga kasus di sini:
 *   1. kode ada di Accurate & belum menambat siapa pun -> ok
 *   2. kode ngawur                                      -> "tidak ditemukan"
 *   3. kode yang sudah menambat satu produk web         -> "sudah menambat"
 */
import { config } from "dotenv"

config({ path: ".env.local" })

const { periksaKode } = await import("@/lib/api/accurate/price-table")
const { getPrisma } = await import("@/lib/prisma/client")

let lolos = 0
let gagal = 0

function periksa(nama: string, syarat: boolean, keterangan: string) {
  if (syarat) {
    lolos++
    console.log(`  OK    ${nama} — ${keterangan}`)
  } else {
    gagal++
    console.log(`  GAGAL ${nama} — ${keterangan}`)
  }
}

const prisma = getPrisma()

try {
  const ngawur = await periksaKode("ZZ-TEST-KODE-TIDAK-ADA-9999")
  periksa(
    "kode ngawur ditolak",
    !ngawur.ok && ngawur.alasan.includes("tidak ditemukan"),
    JSON.stringify(ngawur),
  )

  const tertaut = await prisma.$queryRawUnsafe<{ kode: string; nama: string }[]>(
    "SELECT accurate_code AS kode, name AS nama FROM products WHERE accurate_code IS NOT NULL LIMIT 1",
  )
  if (tertaut.length === 0) {
    console.log("  LEWAT kasus 'sudah menambat' — tidak ada produk tertaut di DB ini")
  } else {
    const hasil = await periksaKode(tertaut[0]!.kode)
    periksa(
      "kode yang sudah menambat produk ditolak",
      !hasil.ok && hasil.alasan.includes("sudah menambat produk lain"),
      `${tertaut[0]!.kode} -> ${JSON.stringify(hasil)}`,
    )
  }

  const bebas = await prisma.$queryRawUnsafe<{ kode: string; nama: string | null }[]>(
    "SELECT a.`Kode Accurate` AS kode, a.`NAMA BARANG` AS nama FROM accurate_products a " +
      "LEFT JOIN products p ON p.accurate_code = a.`Kode Accurate` WHERE p.woo_id IS NULL LIMIT 1",
  )
  if (bebas.length === 0) {
    console.log("  LEWAT kasus 'kode bebas' — semua kode Accurate sudah tertaut")
  } else {
    const hasil = await periksaKode(bebas[0]!.kode)
    periksa(
      "kode sah & bebas diterima",
      hasil.ok && hasil.namaBarang.length > 0,
      `${bebas[0]!.kode} -> ${JSON.stringify(hasil)}`,
    )

    const berspasi = await periksaKode(`  ${bebas[0]!.kode}  `)
    periksa("spasi di ujung dipangkas", berspasi.ok, JSON.stringify(berspasi))
  }

  const kosong = await periksaKode("   ")
  periksa("isian kosong ditolak", !kosong.ok, JSON.stringify(kosong))

  console.log(`\n${lolos} lolos, ${gagal} gagal`)
} finally {
  await prisma.$disconnect()
}

process.exit(gagal > 0 ? 1 : 0)
