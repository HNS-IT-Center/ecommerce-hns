/**
 * Pembaca angka harga dari Google Sheet, dengan pemisah ribuan Indonesia.
 *
 * TERPISAH dari `parseHargaAccurate` di `stock-db.ts`, dan bedanya penting:
 *
 * - `parseHargaAccurate` membaca nilai yang SUDAH tersimpan di
 *   `accurate_products`. Ia membuang seluruh karakter non-digit, dan untuk isi
 *   tabel sekarang itu benar — 0 dari 21.567 nilai memuat koma maupun bagian
 *   desimal, jadi tidak ada yang bisa salah dibaca.
 * - Berkas ini membaca nilai yang BARU DATANG dari Sheet, yang bentuknya belum
 *   dijamin apa pun. Kalau ekspor Accurate suatu saat mengirim "5254054.00",
 *   membuang non-digit menghasilkan 525.405.400 — seratus kali lipat, dan
 *   angka itu berakhir di layar pelanggan.
 *
 * **Kenapa ini ditulis sama sekali:** 236 nilai di tabel sekarang rusak karena
 * pembacaan yang memperlakukan "165.000" sebagai bilangan desimal 165,0 lalu
 * menyimpannya "165". Importer berikutnya tidak boleh mengulang kesalahan itu.
 *
 * ATURAN PEMISAH, berurutan:
 *
 *  1. Ada titik DAN koma  → yang muncul TERAKHIR adalah pemisah desimal,
 *                            yang lain pemisah ribuan. Menangani "1.250,50"
 *                            (Indonesia) maupun "1,250.50" (Inggris).
 *  2. Hanya satu jenis, muncul >1 kali → pemisah ribuan. "6.000.000".
 *  3. Hanya satu jenis, muncul 1 kali:
 *       ekor 3 digit  → RIBUAN. "125.000" = seratus dua puluh lima ribu.
 *       ekor 1-2 digit → desimal. "5254054.00" = lima juta dua ratus lima puluh
 *                        empat ribu lima puluh empat.
 *       ekor 4+ digit  → bukan pemisah; ditolak sebagai tak terbaca.
 *
 * Aturan 3 adalah inti persoalannya. "125.000" ambigu secara sintaks — bisa
 * dibaca 125 koma nol nol nol. Yang memutuskannya konvensi Indonesia, dan itu
 * pilihan sadar: rupiah tidak punya pecahan dalam praktik, jadi "125,000
 * rupiah" bukan harga yang pernah ditulis orang, sedangkan 125 ribu ditulis
 * setiap hari. 176 nilai berbentuk ini ada di tabel sekarang, semuanya ribuan.
 *
 * Hasilnya SELALU bilangan bulat rupiah. Pecahan dibuang dengan pembulatan,
 * bukan dipertahankan — tidak ada harga setengah rupiah.
 *
 * Yang TIDAK dilakukan: menebak. Angka yang terbaca 165 tetap 165, tidak
 * dikalikan seribu walau jelas mencurigakan — menebak harga yang berakhir di
 * layar pelanggan dilarang (CLAUDE.md §2.7). Yang mencurigakan diberi
 * `catatan`, persis seperti `parseHargaAccurate`.
 */

/** Di bawah ini dianggap mencurigakan — sama dengan ambang di `stock-db.ts`. */
export const AMBANG_HARGA_RENDAH = 1000

export type HargaSheet = {
  /** Rupiah bulat, atau `null` kalau tidak ada harga / tidak terbaca. */
  nilai: number | null
  /** Terisi kalau angkanya perlu dilihat manusia. `null` berarti wajar. */
  catatan: string | null
}

/**
 * Buang yang jelas bukan bagian dari angka: simbol mata uang, spasi, dan
 * spasi tak-putus yang sering ikut tersalin dari spreadsheet.
 */
function bersihkan(raw: string): string {
  return raw
    .replace(/ /g, " ")
    .replace(/rp\.?/gi, "")
    .replace(/\s/g, "")
    .trim()
}

/**
 * Apakah pengelompokan ribuan wajar: kelompok pertama 1-3 digit, sisanya
 * TEPAT 3 digit.
 *
 * "6.400.000" dan "125.000" wajar. "12.34.567" tidak — pengelompokan seperti
 * itu tidak pernah ditulis orang maupun dihasilkan sistem yang waras, jadi
 * kemunculannya di Sheet lebih mungkin berarti kolom bergeser atau selnya
 * korup daripada angka yang perlu diselamatkan.
 *
 * Nilainya tetap dibaca — impor tidak boleh gagal total karena satu sel aneh —
 * tapi hasilnya diberi catatan supaya muncul di laporan impor dan ditinjau
 * manusia. Menerimanya diam-diam adalah pola yang sama persis dengan yang
 * melahirkan kerusakan 236 nilai itu: parser yang terlalu ramah pada masukan
 * yang seharusnya membunyikan alarm.
 */
function pengelompokanWajar(bagianBulat: string): boolean {
  const kelompok = bagianBulat.split(/[.,]/)
  if (kelompok.length === 1) return true // tanpa pemisah — tidak ada yang bisa salah
  const [pertama, ...sisanya] = kelompok
  if (pertama!.length < 1 || pertama!.length > 3) return false
  return sisanya.every((k) => k.length === 3)
}

/**
 * Tentukan posisi pemisah desimal, atau -1 kalau seluruh pemisah adalah
 * pemisah ribuan. Lihat tabel aturan di kepala berkas.
 */
function posisiDesimal(teks: string): number {
  const titikTerakhir = teks.lastIndexOf(".")
  const komaTerakhir = teks.lastIndexOf(",")

  // Aturan 1 — dua jenis pemisah: yang terakhir yang desimal.
  if (titikTerakhir !== -1 && komaTerakhir !== -1) {
    return Math.max(titikTerakhir, komaTerakhir)
  }

  const pos = titikTerakhir !== -1 ? titikTerakhir : komaTerakhir
  if (pos === -1) return -1

  const pemisah = teks[pos]!
  const jumlah = teks.split(pemisah).length - 1

  // Aturan 2 — muncul lebih dari sekali: pasti pemisah ribuan.
  if (jumlah > 1) return -1

  // Aturan 3 — sekali saja: panjang ekornya yang memutuskan.
  const ekor = teks.length - pos - 1
  if (ekor === 3) return -1 // "125.000" → ribuan (konvensi Indonesia)
  if (ekor >= 1 && ekor <= 2) return pos // "5254054.00" → desimal
  return -2 // ekor 0 atau 4+ digit: bukan pemisah yang masuk akal
}

/**
 * Baca satu sel harga dari Sheet.
 *
 * @param raw Nilai sel apa adanya. `null`/`undefined`/kosong berarti tidak ada
 *            harga — itu keadaan normal, bukan galat.
 */
export function parseHargaSheet(raw: string | null | undefined): HargaSheet {
  if (raw === null || raw === undefined) return { nilai: null, catatan: null }

  const teks = bersihkan(raw)
  if (teks === "") return { nilai: null, catatan: null }

  // Tanda minus hanya sah di depan. Harga negatif tetap dibaca lalu ditolak di
  // bawah — supaya catatannya menyebut apa yang sebenarnya tertulis.
  const negatif = teks.startsWith("-")
  const angka = negatif ? teks.slice(1) : teks

  if (!/^[0-9.,]+$/.test(angka)) {
    return { nilai: null, catatan: `tidak terbaca sebagai angka: "${raw}"` }
  }

  const pos = posisiDesimal(angka)
  if (pos === -2) {
    return { nilai: null, catatan: `pemisah angka tidak dikenali: "${raw}"` }
  }

  const bagianBulat = pos === -1 ? angka : angka.slice(0, pos)
  const bulat = bagianBulat.replace(/[.,]/g, "")
  const pecahan = pos === -1 ? "" : angka.slice(pos + 1).replace(/[.,]/g, "")

  // Diperiksa sebelum nilainya dihitung, supaya catatannya bisa menyebut teks
  // aslinya apa adanya.
  const kelompokAneh = !pengelompokanWajar(bagianBulat)

  if (bulat === "" && pecahan === "") {
    return { nilai: null, catatan: `tidak terbaca sebagai angka: "${raw}"` }
  }

  const nilai = Number(`${bulat || "0"}.${pecahan || "0"}`)
  if (!Number.isFinite(nilai)) {
    return { nilai: null, catatan: `tidak terbaca sebagai angka: "${raw}"` }
  }

  // Rupiah tidak punya pecahan dalam praktik; dibulatkan, bukan dipertahankan.
  const rupiah = Math.round(negatif ? -nilai : nilai)

  if (rupiah <= 0) {
    return { nilai: null, catatan: `nilai tidak wajar: "${raw}"` }
  }

  // Keduanya bisa menyala bersamaan, dan dua-duanya perlu sampai ke laporan —
  // yang satu menyoal bentuk tulisannya, yang lain besaran hasilnya.
  const catatan: string[] = []
  if (kelompokAneh) {
    catatan.push(
      `pengelompokan angka tidak wajar: "${raw}" — dibaca ${rupiah.toLocaleString("id-ID")}, ` +
        `tapi bentuk seperti ini biasanya menandakan sel korup atau kolom bergeser`,
    )
  }
  if (rupiah < AMBANG_HARGA_RENDAH) {
    catatan.push(`harga sangat rendah (${rupiah}) — mungkin ribuan terpotong, cek dulu`)
  }

  return { nilai: rupiah, catatan: catatan.length > 0 ? catatan.join(" · ") : null }
}
