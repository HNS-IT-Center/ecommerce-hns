/**
 * Mengukur kesanggupan pencocokan nama Accurate <-> produk web. BACA SAJA.
 *
 *   npx tsx --tsconfig scripts/tsconfig.uji.json --conditions=react-server \
 *     scripts/uji-pencocokan-nama.mts
 *
 * TIDAK menautkan apa pun dan tidak menulis satu baris pun. Tujuannya menjawab
 * satu pertanyaan sebelum fitur usulan pasangan dibangun: kalau mesin
 * mengurutkan kandidat, seberapa sering jawaban yang benar ada di 3 teratas?
 *
 * KUNCI JAWABAN: produk web yang `sku`-nya sama persis dengan `accurate_code`
 * miliknya. Pasangan itu tidak ditebak — staff sendiri yang dulu mengisinya,
 * dan kecocokan harfiah kode tidak mungkin kebetulan.
 *
 * KUNCI JAWABAN INI BIAS, dan angkanya harus dibaca dengan itu di kepala:
 * produk yang ber-SKU cenderung penamaannya rapi, sedangkan antrean yang
 * sesungguhnya justru berisi yang penamaannya berantakan. Jadi hasil di sini
 * adalah BATAS ATAS — harapan realistis pasti di bawahnya.
 *
 * Cara skornya: token yang jarang diberi bobot besar (IDF). Kode model seperti
 * `M171` atau `H510M-B` muncul di segelintir baris, sedangkan `MOUSE` atau
 * `LOGITECH` muncul ratusan kali dan nyaris tidak membedakan apa pun.
 */
import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

const { getPrisma } = await import("../src/lib/prisma/client")
const prisma = getPrisma()

/**
 * Pecah nama jadi token.
 *
 * Tanda hubung dipertahankan DI DALAM token karena kode model memang memuatnya
 * (`H510M-B`, `AL14-51M-59YA`) — tapi pecahannya juga ikut dikeluarkan, dan itu
 * bukan kerapian: dua sumber ini menulis kode yang sama dengan pemisah berbeda.
 *
 *     ACC: RYZEN 7 5700G      ->  "7", "5700G"
 *     WEB: RYZEN 7-5700G      ->  "7-5700G"
 *
 * Tanpa mengeluarkan pecahannya, dua nama yang jelas-jelas barang yang sama
 * tidak berbagi satu token pun pada bagian yang paling menentukan. Ini bukan
 * dugaan — lima contoh gagal pertama pada pengukuran sebelumnya, tiga di
 * antaranya persis kasus ini.
 */
function token(nama: string): string[] {
  const kasar = nama
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^[.\-]+|[.\-]+$/g, ""))
    .filter((t) => t.length >= 2)

  const hasil = new Set<string>()
  for (const t of kasar) {
    hasil.add(t)
    if (t.includes("-")) {
      for (const bagian of t.split("-")) {
        if (bagian.length >= 2) hasil.add(bagian)
      }
    }
  }
  return [...hasil]
}

/** Token yang memuat huruf DAN angka — ciri kode model. */
const berkodeModel = (t: string) => /[A-Z]/.test(t) && /[0-9]/.test(t)

try {
  const produk = await prisma.$queryRawUnsafe<
    { wooId: number; nama: string; sku: string | null; kode: string | null }[]
  >(
    "SELECT woo_id AS wooId, name AS nama, sku, accurate_code AS kode FROM products WHERE name IS NOT NULL",
  )
  const barang = await prisma.$queryRawUnsafe<{ kode: string; nama: string | null }[]>(
    "SELECT `Kode Accurate` AS kode, `NAMA BARANG` AS nama FROM accurate_products",
  )

  const namaBarang = new Map(barang.map((b) => [b.kode, b.nama ?? ""]))

  // --- Korpus & IDF dari sisi web -------------------------------------------
  const tokenProduk = produk.map((p) => token(p.nama))
  const df = new Map<string, number>()
  for (const ts of tokenProduk) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1)
  const N = produk.length
  const idf = (t: string) => Math.log(N / (1 + (df.get(t) ?? 0)))

  // Indeks terbalik: token -> indeks produk. Tanpa ini tiap barang harus
  // dibandingkan ke 5.000+ produk satu per satu.
  const indeks = new Map<string, number[]>()
  tokenProduk.forEach((ts, i) => {
    for (const t of ts) {
      const arr = indeks.get(t)
      if (arr) arr.push(i)
      else indeks.set(t, [i])
    }
  })

  /** Peringkat kandidat produk web untuk satu nama barang Accurate. */
  function peringkat(namaAcc: string, batas = 5) {
    const ts = token(namaAcc)
    const skor = new Map<number, number>()
    for (const t of ts) {
      const bobot = idf(t)
      // Token yang muncul di > 20% katalog tidak membedakan apa pun.
      if ((df.get(t) ?? 0) > N * 0.2) continue
      for (const i of indeks.get(t) ?? []) skor.set(i, (skor.get(i) ?? 0) + bobot)
    }
    return [...skor.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, batas)
      .map(([i, s]) => ({ i, skor: s }))
  }

  // --- Kunci jawaban ---------------------------------------------------------
  const kunci = produk
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.kode && p.sku && p.sku.trim() === p.kode.trim() && namaBarang.get(p.kode!))

  console.log(`\nProduk web         : ${produk.length.toLocaleString("id-ID")}`)
  console.log(`Barang Accurate    : ${barang.length.toLocaleString("id-ID")}`)
  console.log(`Pasangan kunci     : ${kunci.length.toLocaleString("id-ID")}  (sku == accurate_code)\n`)

  let berbagiKodeModel = 0
  let di1 = 0
  let di3 = 0
  let di5 = 0
  let takMasuk = 0
  const contohGagal: string[] = []

  for (const k of kunci) {
    const namaAcc = namaBarang.get(k.kode!)!
    const tAcc = new Set(token(namaAcc))
    const tWeb = new Set(token(k.nama))
    const bersamaKode = [...tAcc].some((t) => berkodeModel(t) && tWeb.has(t))
    if (bersamaKode) berbagiKodeModel++

    const hasil = peringkat(namaAcc, 5)
    const posisi = hasil.findIndex((h) => h.i === k.i)
    if (posisi === 0) di1++
    if (posisi >= 0 && posisi < 3) di3++
    if (posisi >= 0 && posisi < 5) di5++
    if (posisi < 0) {
      takMasuk++
      if (contohGagal.length < 8) {
        // Kode & wooId ikut dicetak: sebagian "kegagalan" di sini ternyata
        // bukan mesin yang keliru, melainkan PASANGANNYA yang salah sejak awal
        // (NVMe ditautkan ke produk SATA, misalnya). Tanpa kodenya, temuan
        // seperti itu tidak bisa ditindaklanjuti siapa pun.
        contohGagal.push(
          `      kode ${k.kode}  (woo ${k.wooId})\n      ACC: ${namaAcc}\n      WEB: ${k.nama}`,
        )
      }
    }
  }

  /**
   * Tautan yang PATUT DICURIGAI: dua namanya tidak berbagi satu pun token
   * pembeda. Bukan sekadar "mesin gagal menebak" — kalau nama barang kasir dan
   * nama produk web sama sekali tidak beririsan, besar kemungkinan tautannya
   * memang salah pasang.
   *
   * Sengaja dipisah dari angka "tidak masuk 5 besar": yang itu mengukur
   * kesanggupan mesin, yang ini mengukur kesehatan DATA yang sudah ada.
   */
  const mencurigakan: string[] = []
  for (const k of kunci) {
    const namaAcc = namaBarang.get(k.kode!)!
    const tAcc = token(namaAcc)
    const tWeb = new Set(token(k.nama))
    const bersama = tAcc.filter((t) => tWeb.has(t) && (df.get(t) ?? 0) <= N * 0.2)
    if (bersama.length === 0) {
      mencurigakan.push(
        `  kode ${k.kode}  (woo ${k.wooId})\n    ACC: ${namaAcc}\n    WEB: ${k.nama}`,
      )
    }
  }

  const pct = (n: number) => `${((n / kunci.length) * 100).toFixed(1)}%`

  console.log("=== Hipotesis: kode model ada di kedua nama ===")
  console.log(`  berbagi token berkode model : ${berbagiKodeModel} (${pct(berbagiKodeModel)})\n`)

  console.log("=== Kesanggupan peringkat (kunci jawaban) ===")
  console.log(`  jawaban benar di posisi 1   : ${di1} (${pct(di1)})`)
  console.log(`  jawaban benar di 3 teratas  : ${di3} (${pct(di3)})`)
  console.log(`  jawaban benar di 5 teratas  : ${di5} (${pct(di5)})`)
  console.log(`  tidak masuk 5 besar         : ${takMasuk} (${pct(takMasuk)})`)

  if (contohGagal.length > 0) {
    console.log("\n=== Contoh yang TIDAK masuk 5 besar ===")
    for (const c of contohGagal) console.log(c + "\n")
  }

  console.log("\n=== TAUTAN YANG PATUT DICURIGAI (nol token pembeda) ===")
  console.log(
    `  ${mencurigakan.length} dari ${kunci.length} pasangan (${pct(mencurigakan.length)})`,
  )
  console.log("  Ini soal KESEHATAN DATA, bukan kesanggupan mesin — dua nama yang")
  console.log("  sama sekali tidak beririsan besar kemungkinan memang salah pasang.\n")
  for (const m of mencurigakan.slice(0, 12)) console.log(m + "\n")
  if (mencurigakan.length > 12) {
    console.log(`  ... dan ${mencurigakan.length - 12} lagi\n`)
  }

  console.log(
    "Ingat: kunci jawaban ini BIAS (produk ber-SKU penamaannya lebih rapi),\njadi angka di atas batas ATAS, bukan harapan realistis.\n",
  )
} finally {
  await prisma.$disconnect()
}
