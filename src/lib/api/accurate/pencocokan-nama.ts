/**
 * Pencocokan nama barang Accurate <-> produk web.
 *
 * Fungsi murni, tanpa database: pemanggilnya yang mengambil data, modul ini
 * yang mengurutkan. Dipisah begitu supaya bisa diukur di luar panel — dan
 * karena angka akurasinya hanya berlaku kalau yang diukur dan yang dipakai
 * benar-benar kode yang sama, bukan dua salinan yang lama-lama berbeda.
 *
 * ATURAN YANG TIDAK BOLEH DILANGGAR PEMAKAINYA (docs/13 §5):
 *
 *   Mesin mengurutkan, TIDAK PERNAH memilih.
 *
 * Modul ini sengaja tidak punya fungsi "ambil yang terbaik" atau "tautkan
 * otomatis". Ia mengembalikan daftar kandidat beserta ALASAN — token mana yang
 * cocok — bukan satu jawaban. Percobaan fuzzy sebelumnya di project ini
 * menghasilkan 1.092 baris berskor 100 yang menunjuk produk tidak ada; skor
 * tinggi bukan tanda benar.
 *
 * Akurasi terukur (21 September 2026, `scripts/uji-pencocokan-nama.mts`,
 * kunci jawaban 941 pasangan `sku == accurate_code`):
 *
 *   benar di posisi 1   : 81,0%
 *   benar di 3 teratas  : 93,1%
 *   meleset dari 5 besar:  4,1%
 *
 * Itu BATAS ATAS. Kunci jawabannya bias — produk ber-SKU penamaannya rapi,
 * sedangkan antrean sesungguhnya justru yang berantakan.
 */

/** Ambang token terlalu umum: muncul di lebih dari sekian bagian katalog. */
const AMBANG_UMUM = 0.2

/**
 * Pecah nama jadi token pembanding.
 *
 * Tanda hubung dipertahankan DI DALAM token karena kode model memang memuatnya
 * (`H510M-B`, `AL14-51M-59YA`) — tapi pecahannya ikut dikeluarkan juga, dan itu
 * bukan kerapian: dua sumber ini menulis kode yang sama dengan pemisah berbeda.
 *
 *     ACC: RYZEN 7 5700G   ->  "7", "5700G"
 *     WEB: RYZEN 7-5700G   ->  "7-5700G", "7", "5700G"
 *
 * Tanpa pecahan itu, dua nama yang jelas barang sama tidak berbagi satu token
 * pun pada bagian yang paling menentukan. Diukur: menambahkannya menaikkan
 * ketepatan 3-teratas dari 91,0% ke 93,1%.
 */
export function tokenNama(nama: string): string[] {
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
      for (const bagian of t.split("-")) if (bagian.length >= 2) hasil.add(bagian)
    }
  }
  return [...hasil]
}

/** Token yang memuat huruf DAN angka — ciri kode model (`M171`, `H510M`). */
export function berkodeModel(token: string): boolean {
  return /[A-Z]/.test(token) && /[0-9]/.test(token)
}

export type ProdukRingkas = { wooId: number; nama: string }

export type Kandidat = {
  wooId: number
  nama: string
  /**
   * Token yang cocok, terurut dari yang paling jarang.
   *
   * Inilah yang ditampilkan ke staff — BUKAN skornya. Skor adalah angka tanpa
   * arti bagi orang yang harus memutuskan; "cocok pada M171, WIRELESS" bisa
   * dinilai benar-salahnya dalam sekali baca.
   */
  alasan: string[]
  /** Apakah ada token kode model di antara yang cocok. */
  adaKodeModel: boolean
}

/**
 * Indeks siap pakai untuk mencocokkan banyak nama ke katalog yang sama.
 *
 * Dibangun sekali, dipakai berulang. Tanpa indeks terbalik, tiap barang harus
 * dibandingkan satu per satu ke 5.000+ produk.
 */
export type IndeksKatalog = {
  produk: ProdukRingkas[]
  tokenProduk: string[][]
  df: Map<string, number>
  indeks: Map<string, number[]>
  total: number
}

export function bangunIndeks(produk: ProdukRingkas[]): IndeksKatalog {
  const tokenProduk = produk.map((p) => tokenNama(p.nama))
  const df = new Map<string, number>()
  for (const ts of tokenProduk) for (const t of ts) df.set(t, (df.get(t) ?? 0) + 1)

  const indeks = new Map<string, number[]>()
  tokenProduk.forEach((ts, i) => {
    for (const t of ts) {
      const arr = indeks.get(t)
      if (arr) arr.push(i)
      else indeks.set(t, [i])
    }
  })

  return { produk, tokenProduk, df, indeks, total: produk.length }
}

/**
 * Urutkan kandidat produk web untuk satu nama barang Accurate.
 *
 * Bobot tiap token = IDF: token yang jarang bernilai besar, yang umum nyaris
 * nol. `MOUSE` muncul ratusan kali dan tidak membedakan apa pun; `M171` muncul
 * di segelintir baris dan hampir menentukan sendirian.
 *
 * Token yang muncul di lebih dari 20% katalog dibuang sama sekali — bukan
 * diberi bobot kecil. Token seperti itu hanya menambah kandidat tanpa menambah
 * keterangan, dan kandidat yang banyak membuat daftar tidak lagi menolong.
 */
export function peringkatKandidat(
  namaBarang: string,
  katalog: IndeksKatalog,
  batas = 3,
): Kandidat[] {
  const ts = tokenNama(namaBarang)
  const skor = new Map<number, number>()
  const cocok = new Map<number, string[]>()

  for (const t of ts) {
    const dft = katalog.df.get(t) ?? 0
    if (dft === 0 || dft > katalog.total * AMBANG_UMUM) continue
    const bobot = Math.log(katalog.total / (1 + dft))
    for (const i of katalog.indeks.get(t) ?? []) {
      skor.set(i, (skor.get(i) ?? 0) + bobot)
      const daftar = cocok.get(i)
      if (daftar) daftar.push(t)
      else cocok.set(i, [t])
    }
  }

  return [...skor.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, batas)
    .map(([i]) => {
      const alasan = (cocok.get(i) ?? []).sort(
        (a, b) => (katalog.df.get(a) ?? 0) - (katalog.df.get(b) ?? 0),
      )
      return {
        wooId: katalog.produk[i]!.wooId,
        nama: katalog.produk[i]!.nama,
        alasan,
        adaKodeModel: alasan.some(berkodeModel),
      }
    })
}

/**
 * Apakah kandidat-kandidat ini nyaris tak terbedakan satu sama lain?
 *
 * Benar kalau dua kandidat teratas cocok pada token pembeda yang SAMA PERSIS.
 * Itu tanda bahaya yang harus disampaikan ke staff, bukan disembunyikan di
 * balik peringkat: web punya M171 varian `- GREY`, `- BLUE`, `- BLUEGREY`,
 * `- OFFWHITE`, `- RED`, dan satu nama Accurate mirip ke kelimanya. Urutan
 * teratas di antara mereka praktis ditentukan kebetulan.
 *
 * Yang membedakan justru token varian — dan token itu sering TIDAK muncul di
 * nama Accurate sama sekali, jadi mesin memang tidak punya dasar untuk memilih.
 */
export function kandidatKembar(kandidat: Kandidat[]): boolean {
  if (kandidat.length < 2) return false
  const a = [...kandidat[0]!.alasan].sort().join("|")
  const b = [...kandidat[1]!.alasan].sort().join("|")
  return a === b
}
