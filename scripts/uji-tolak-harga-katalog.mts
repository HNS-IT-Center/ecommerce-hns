/**
 * Uji `tolakHargaKatalog` — penjaga harga katalog tidak wajar.
 *
 * TIDAK MENYENTUH DATABASE. Fungsi murni, aman dijalankan kapan saja.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-tolak-harga-katalog.mts
 *
 * Separuh daftar ini kasus yang HARUS LOLOS, bukan yang harus ditolak — dan itu
 * bukan kelengkapan formalitas. Penjaga yang menolak SEMUA harga akan lulus
 * setiap uji penolakan sambil melumpuhkan pekerjaan staff sehari-hari. Yang
 * membuktikan ambangnya benar adalah sisi yang diterima, khususnya nilai tepat
 * di batas: aturannya "DI BAWAH Rp 1.000 ditolak", jadi 1.000 harus masuk.
 */
// `products.ts` menyeret `lib/prisma/client` yang membaca `config/env` saat
// dimuat, dan skema env itu melempar kalau variabelnya tidak ada. Uji ini tidak
// menyentuh database sama sekali — .env.local dimuat semata-mata supaya
// modulnya bisa di-import.
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { tolakHargaKatalog, HARGA_KATALOG_MINIMUM } = await import(
  "../src/lib/api/woocommerce/products"
)

type Kasus = {
  harga: number | null
  tolak: boolean
  kenapa: string
}

const KASUS: { judul: string; daftar: Kasus[] }[] = [
  {
    judul: "HARUS DITERIMA — membuktikan penjaga tidak melumpuhkan alur kerja",
    daftar: [
      { harga: 1000, tolak: false, kenapa: "TEPAT di ambang — aturannya 'di bawah 1.000', jadi 1.000 masuk" },
      { harga: 1001, tolak: false, kenapa: "satu rupiah di atas ambang" },
      { harga: 5000, tolak: false, kenapa: "produk termurah yang sah di katalog (Arctic MX Cleaning Wipes)" },
      { harga: 150_000, tolak: false, kenapa: "harga wajar sehari-hari — kasus 1b" },
      { harga: 165_000, tolak: false, kenapa: "Logitech M171 sesudah harganya diperbaiki" },
      { harga: 48_900_000, tolak: false, kenapa: "laptop termahal di katalog" },
      { harga: 1_234_567_890, tolak: false, kenapa: "miliaran — tidak ada batas atas" },
      { harga: null, tolak: false, kenapa: "tidak diisi; mengosongkan harga obral itu sah" },
    ],
  },
  {
    judul: "HARUS DITOLAK",
    daftar: [
      { harga: 999, tolak: true, kenapa: "satu rupiah di bawah ambang" },
      { harga: 165, tolak: true, kenapa: "Logitech M171 sebelum diperbaiki — ribuan terpotong" },
      { harga: 6, tolak: true, kenapa: "Advan Workplus — yang memicu seluruh pekerjaan ini" },
      { harga: 1, tolak: true, kenapa: "nilai terkecil yang masih positif" },
      { harga: 0, tolak: true, kenapa: "nol bukan harga" },
      { harga: -5000, tolak: true, kenapa: "negatif" },
      { harga: Number.NaN, tolak: true, kenapa: "bukan angka" },
      { harga: Number.POSITIVE_INFINITY, tolak: true, kenapa: "tak hingga" },
    ],
  },
]

let lolos = 0
let gagal = 0

for (const kelompok of KASUS) {
  console.log(`\n=== ${kelompok.judul} ===`)
  for (const k of kelompok.daftar) {
    const alasan = tolakHargaKatalog(k.harga, "Harga normal")
    const ditolak = alasan !== null
    const tampil = k.harga === null ? "null" : String(k.harga)

    if (ditolak === k.tolak) {
      lolos++
      console.log(`  OK    ${tampil.padStart(14)}  ${ditolak ? "DITOLAK" : "diterima"}  ${k.kenapa}`)
    } else {
      gagal++
      console.log(
        `  GAGAL ${tampil.padStart(14)}  ${ditolak ? "DITOLAK" : "diterima"} — harusnya ${k.tolak ? "DITOLAK" : "diterima"}`,
      )
      console.log(`        ${k.kenapa}`)
      if (alasan) console.log(`        pesan: ${alasan}`)
    }
  }
}

console.log(`\n=== Pesan penolakan menyebut angkanya? ===`)
const contoh = tolakHargaKatalog(165, "Harga normal")
console.log(`  ${contoh}`)
const menyebutAngka = contoh !== null && contoh.includes("165")
const menyebutAmbang = contoh !== null && contoh.includes(HARGA_KATALOG_MINIMUM.toLocaleString("id-ID"))
if (menyebutAngka && menyebutAmbang) {
  lolos++
  console.log(`  OK    menyebut angka yang ditolak DAN ambangnya`)
} else {
  gagal++
  console.log(`  GAGAL pesan harus menyebut angka yang ditolak (165) dan ambang (1.000)`)
}

console.log(`\n=== Label ikut ke pesan? (harga normal vs obral) ===`)
const obral = tolakHargaKatalog(6, "Harga obral")
if (obral !== null && obral.startsWith("Harga obral")) {
  lolos++
  console.log(`  OK    "${obral.slice(0, 46)}…"`)
} else {
  gagal++
  console.log(`  GAGAL label tidak ikut: ${obral}`)
}

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
