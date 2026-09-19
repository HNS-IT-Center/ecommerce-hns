/**
 * Uji `parseHargaSheet` — pembaca angka harga dari Google Sheet.
 *
 * TIDAK MENYENTUH DATABASE sama sekali. Seluruhnya fungsi murni, jadi aman
 * dijalankan kapan saja dan tidak memakan kuota koneksi.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json scripts/uji-parse-harga-sheet.mts
 *
 * Dijalankan SEBELUM `import-sheet.ts` disentuh: parser inilah yang menentukan
 * apakah impor berikutnya mengulang kerusakan yang sama atau tidak. 236 nilai
 * di tabel sekarang rusak karena "165.000" dibaca sebagai 165,0 lalu disimpan
 * "165" — kasus itu ada di daftar di bawah sebagai penjaga agar tidak terulang.
 */
import { parseHargaSheet } from "../src/lib/api/accurate/parse-harga-sheet"

type Kasus = {
  masuk: string | null | undefined
  nilai: number | null
  /** true = harus ada catatan, false = harus bersih, undefined = tidak diperiksa */
  catatan?: boolean
  kenapa: string
}

const KASUS: { judul: string; daftar: Kasus[] }[] = [
  {
    judul: "Bentuk yang BENAR-BENAR ADA di tabel sekarang",
    daftar: [
      { masuk: "55000", nilai: 55_000, catatan: false, kenapa: "digit polos — 6.816 nilai berbentuk ini" },
      { masuk: "41441", nilai: 41_441, catatan: false, kenapa: "digit polos, bukan kelipatan ribuan" },
      { masuk: "125.000", nilai: 125_000, catatan: false, kenapa: "1 titik + 3 digit — 176 nilai; INI yang dulu rusak" },
      { masuk: "205.000", nilai: 205_000, catatan: false, kenapa: "idem" },
      { masuk: "6.400.000", nilai: 6_400_000, catatan: false, kenapa: "titik ribuan berlapis — 70 nilai" },
      { masuk: "2.050.000", nilai: 2_050_000, catatan: false, kenapa: "ribuan dengan nol di tengah" },
      { masuk: "", nilai: null, catatan: false, kenapa: "sel kosong — 11 nilai; bukan galat" },
      { masuk: null, nilai: null, catatan: false, kenapa: "kolom tidak ada di baris itu" },
    ],
  },
  {
    judul: "Yang diminta secara eksplisit di brief",
    daftar: [
      { masuk: "6.000.000", nilai: 6_000_000, catatan: false, kenapa: "ribuan Indonesia" },
      { masuk: "6000000", nilai: 6_000_000, catatan: false, kenapa: "digit polos, nilai sama" },
      { masuk: "", nilai: null, catatan: false, kenapa: "string kosong" },
      {
        masuk: "165",
        nilai: 165,
        catatan: true,
        kenapa: "barang 100076 — dibaca apa adanya DAN ditandai, TIDAK ditebak jadi 165.000",
      },
    ],
  },
  {
    judul: "Ribuan berlapis — sampai miliaran",
    daftar: [
      { masuk: "1.000", nilai: 1_000, catatan: false, kenapa: "satu lapis, tepat di ambang" },
      { masuk: "12.500", nilai: 12_500, catatan: false, kenapa: "satu lapis, ekor bukan nol" },
      { masuk: "999.999", nilai: 999_999, catatan: false, kenapa: "satu lapis, tepat di bawah sejuta" },
      { masuk: "1.000.000", nilai: 1_000_000, catatan: false, kenapa: "dua lapis — sejuta" },
      { masuk: "48.900.000", nilai: 48_900_000, catatan: false, kenapa: "dua lapis — laptop termahal di katalog" },
      { masuk: "123.456.789", nilai: 123_456_789, catatan: false, kenapa: "dua lapis, seluruh digitnya berbeda" },
      { masuk: "1.234.567.890", nilai: 1_234_567_890, catatan: false, kenapa: "TIGA lapis — miliaran" },
      { masuk: "1,234,567,890", nilai: 1_234_567_890, catatan: false, kenapa: "tiga lapis gaya Inggris" },
      {
        masuk: "1.234.567.890,25",
        nilai: 1_234_567_890,
        catatan: false,
        kenapa: "tiga lapis + desimal Indonesia; pecahan dibulatkan ke bawah",
      },
      {
        masuk: "1,234,567,890.75",
        nilai: 1_234_567_891,
        catatan: false,
        kenapa: "tiga lapis + desimal Inggris; pecahan dibulatkan ke atas",
      },
    ],
  },
  {
    judul: "Pengelompokan tidak wajar — dibaca TAPI wajib bercatatan",
    daftar: [
      {
        masuk: "12.34.567",
        nilai: 1_234_567,
        catatan: true,
        kenapa: "kelompok tengah 2 digit — impor tidak gagal, tapi harus muncul di laporan",
      },
      {
        masuk: "1.2345.678",
        nilai: 12_345_678,
        catatan: true,
        kenapa: "kelompok tengah 4 digit",
      },
      {
        masuk: "1234.567",
        nilai: 1_234_567,
        catatan: true,
        kenapa: "kelompok pertama 4 digit — seharusnya paling banyak 3",
      },
      {
        masuk: "12.34.567,50",
        nilai: 1_234_568,
        catatan: true,
        kenapa: "pengelompokan aneh pada bagian bulat, walau desimalnya sah",
      },
      {
        masuk: "1.23",
        nilai: 1,
        catatan: true,
        kenapa: "desimal SAH (bagian bulat '1' satu kelompok) — catatannya soal nilainya, bukan bentuknya",
      },
      {
        masuk: "1.2.3",
        nilai: 123,
        catatan: true,
        kenapa: "DUA catatan sekaligus: pengelompokan aneh DAN hasilnya di bawah ambang",
      },
      { masuk: "123.456", nilai: 123_456, catatan: false, kenapa: "pembanding: 3+3 digit itu WAJAR" },
      { masuk: "1.000.000", nilai: 1_000_000, catatan: false, kenapa: "pembanding: 1+3+3 juga wajar" },
    ],
  },
  {
    judul: "Desimal — bahaya kalau non-digit dibuang begitu saja",
    daftar: [
      { masuk: "5254054.00", nilai: 5_254_054, catatan: false, kenapa: "tanpa aturan ini jadi 525.405.400 (100x)" },
      { masuk: "5254054.5", nilai: 5_254_055, catatan: false, kenapa: "pecahan dibulatkan; rupiah tidak punya sen" },
      { masuk: "1.250,50", nilai: 1_251, catatan: false, kenapa: "Indonesia: titik ribuan, koma desimal" },
      { masuk: "1,250.50", nilai: 1_251, catatan: false, kenapa: "Inggris: koma ribuan, titik desimal" },
      { masuk: "1,250", nilai: 1_250, catatan: false, kenapa: "koma + 3 digit = ribuan, sama seperti titik" },
    ],
  },
  {
    judul: "Sampah dan tepian",
    daftar: [
      { masuk: "-", nilai: null, catatan: true, kenapa: "strip saja, tanpa angka" },
      { masuk: "abc", nilai: null, catatan: true, kenapa: "huruf" },
      { masuk: "0", nilai: null, catatan: true, kenapa: "nol bukan harga" },
      { masuk: "-5000", nilai: null, catatan: true, kenapa: "harga negatif ditolak" },
      { masuk: "   ", nilai: null, catatan: false, kenapa: "spasi saja = kosong, bukan galat" },
      { masuk: "Rp 1.250.000", nilai: 1_250_000, catatan: false, kenapa: "simbol mata uang ikut tersalin" },
      { masuk: "1 250 000", nilai: 1_250_000, catatan: false, kenapa: "spasi sebagai pemisah ribuan" },
      { masuk: "1.2345", nilai: null, catatan: true, kenapa: "ekor 4 digit — bukan pemisah yang masuk akal" },
      { masuk: "999", nilai: 999, catatan: true, kenapa: "tepat di bawah ambang — dibaca tapi ditandai" },
      { masuk: "1000", nilai: 1_000, catatan: false, kenapa: "tepat di ambang — bersih" },
      { masuk: "5000", nilai: 5_000, catatan: false, kenapa: "produk termurah yang sah di katalog" },
    ],
  },
]

let lolos = 0
let gagal = 0

for (const kelompok of KASUS) {
  console.log(`\n=== ${kelompok.judul} ===`)
  for (const k of kelompok.daftar) {
    const hasil = parseHargaSheet(k.masuk)
    const nilaiCocok = hasil.nilai === k.nilai
    const catatanCocok =
      k.catatan === undefined ? true : k.catatan ? hasil.catatan !== null : hasil.catatan === null

    const tampil = k.masuk === null ? "null" : JSON.stringify(k.masuk)
    if (nilaiCocok && catatanCocok) {
      lolos++
      const tanda = hasil.catatan ? " !" : "  "
      console.log(`  OK  ${tampil.padEnd(16)} -> ${String(hasil.nilai).padStart(10)}${tanda} ${k.kenapa}`)
    } else {
      gagal++
      console.log(`  GAGAL ${tampil.padEnd(14)} -> ${String(hasil.nilai).padStart(10)}  (harusnya ${k.nilai})`)
      if (!catatanCocok) {
        console.log(`        catatan: ${JSON.stringify(hasil.catatan)} — harusnya ${k.catatan ? "ADA" : "kosong"}`)
      }
      console.log(`        ${k.kenapa}`)
    }
  }
}

console.log(`\nHASIL: ${lolos} lolos, ${gagal} gagal`)
process.exit(gagal > 0 ? 1 : 0)
