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
const { tokenNama: token, berkodeModel, bangunIndeks, peringkatKandidat } = await import(
  "../src/lib/api/accurate/pencocokan-nama"
)
const prisma = getPrisma()

try {
  const produk = await prisma.$queryRawUnsafe<
    { wooId: number; nama: string; sku: string | null; kode: string | null }[]
  >(
    "SELECT woo_id AS wooId, name AS nama, sku, accurate_code AS kode FROM products WHERE name IS NOT NULL",
  )
  const barang = await prisma.$queryRawUnsafe<
    { kode: string; nama: string | null; kategori: string | null; brand: string | null }[]
  >(
    "SELECT `Kode Accurate` AS kode, `NAMA BARANG` AS nama, `KATEGORI` AS kategori, `NAMA BRAND` AS brand FROM accurate_products",
  )

  const namaBarang = new Map(barang.map((b) => [b.kode, b.nama ?? ""]))
  const infoBarang = new Map(barang.map((b) => [b.kode, b]))

  /**
   * Kategori & brand sisi web. Satu produk bisa berada di beberapa kategori,
   * jadi dikumpulkan jadi daftar — kecocokan dihitung kalau kategori Accurate
   * menyamai SALAH SATU di antaranya.
   *
   * `product_categories.product_id` menunjuk `products.id` INTERNAL, bukan
   * `woo_id`. Dua ruang id itu bertabrakan di project ini, jadi join-nya lewat
   * `p.id` dan hasilnya baru dipetakan ke wooId.
   */
  const meta = await prisma.$queryRawUnsafe<
    { wooId: number; brand: string | null; kategori: string | null }[]
  >(
    `SELECT p.woo_id AS wooId, b.name AS brand, GROUP_CONCAT(c.name SEPARATOR '||') AS kategori
       FROM products p
       LEFT JOIN brands b               ON b.id = p.brand_id
       LEFT JOIN product_categories pc  ON pc.product_id = p.id
       LEFT JOIN categories c           ON c.id = pc.category_id
      GROUP BY p.woo_id, b.name`,
  )
  const metaWeb = new Map(meta.map((m) => [m.wooId, m]))

  /**
   * Indeks dibangun oleh FUNGSI YANG SAMA dengan yang nanti dipakai panel
   * (`lib/api/accurate/pencocokan-nama.ts`). Itu syaratnya angka di bawah
   * berlaku untuk apa pun: kalau skrip ini memakai salinan logikanya sendiri,
   * yang terukur adalah salinan itu, bukan yang benar-benar dijalankan staff.
   */
  const katalog = bangunIndeks(produk.map((p) => ({ wooId: p.wooId, nama: p.nama })))
  const df = katalog.df
  const N = katalog.total

  // --- Kunci jawaban ---------------------------------------------------------
  const kunci = produk.filter(
    (p) => p.kode && p.sku && p.sku.trim() === p.kode.trim() && namaBarang.get(p.kode!),
  )

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

    const hasil = peringkatKandidat(namaAcc, katalog, 5)
    const posisi = hasil.findIndex((h) => h.wooId === k.wooId)
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

  /**
   * Apakah kosakata kategori & brand di dua sistem sepadan?
   *
   * Ini HARUS diukur sebelum penyempitan kategori dipakai. Kalau Accurate
   * menulis "KOMPONEN PC / NB" sedangkan web menulis "Motherboard", menyaring
   * kandidat menurut kategori justru membuang jawaban yang benar — dan
   * kegagalannya tidak kelihatan, karena yang hilang tidak pernah muncul.
   */
  const samakan = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "")
  let katCocok = 0
  let katAda = 0
  let brandCocok = 0
  let brandAda = 0

  for (const k of kunci) {
    const acc = infoBarang.get(k.kode!)
    const web = metaWeb.get(k.wooId)
    if (acc?.kategori && web?.kategori) {
      katAda++
      const daftar = web.kategori.split("||").map(samakan)
      if (daftar.includes(samakan(acc.kategori))) katCocok++
    }
    if (acc?.brand && web?.brand) {
      brandAda++
      if (samakan(acc.brand) === samakan(web.brand)) brandCocok++
    }
  }

  console.log("=== Sepadan tidaknya kategori & brand antar sistem ===")
  console.log(
    `  kategori sama persis : ${katCocok}/${katAda} (${katAda ? ((katCocok / katAda) * 100).toFixed(1) : "—"}%)`,
  )
  console.log(
    `  brand sama persis    : ${brandCocok}/${brandAda} (${brandAda ? ((brandCocok / brandAda) * 100).toFixed(1) : "—"}%)\n`,
  )

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
