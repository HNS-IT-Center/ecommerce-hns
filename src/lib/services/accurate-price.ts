import "server-only"

import { getPrisma } from "@/lib/prisma/client"
import {
  isStockDataAvailable,
  parseHargaAccurate,
  type HargaAccurate,
} from "@/lib/api/accurate/stock-db"

/**
 * Menyandingkan harga Accurate (dari DB `updatewoo`) dengan katalog web
 * (`ecommerce_hns`), lewat kunci `woo_product_id` (Accurate) = `wooId` (web).
 *
 * Ini SATU-SATUNYA tempat kedua sumber bertemu. Halaman /harga-accurate memakai
 * hasilnya untuk pratinjau; server action penerapan memakai `AccuratePriceRow`
 * yang sama supaya yang ditulis persis yang ditampilkan (§2.7: harga yang masuk
 * katalog wajib sama dengan yang dilihat staff saat menyetujui).
 *
 * `SP` Accurate (Selling Price) → `regularPrice` web. `CP` (Cost Price / harga
 * modal) TIDAK pernah dibaca ke sini: itu angka internal, tak boleh menyentuh
 * apa pun yang tampil ke pelanggan.
 */

export type AccuratePriceRow = {
  /** Kode Accurate — identitas UNIK per baris. Satu wooId bisa muncul di lebih
   *  dari satu baris (beberapa kode Accurate ter-pairing ke satu produk web),
   *  jadi jangan pakai wooId sebagai key/seleksi React — pakai ini. */
  kodeAccurate: string
  productId: number
  wooId: number
  nama: string
  slug: string
  status: string
  hargaWebSekarang: number | null
  hargaAccurate: HargaAccurate
  /** selisih persen (harga Accurate vs web); null kalau salah satunya tak ada. */
  selisihPersen: number | null
  /**
   * Alasan baris ini TIDAK boleh diterapkan otomatis (harga kosong, angka aneh).
   * Kosong = boleh dicentang staff. Ini catatan, bukan blokir: staff tetap
   * melihat semuanya, tapi baris ber-`peringatan` tidak ikut tercentang default.
   */
  peringatan: string | null
  /**
   * Harga ini terakhir diubah MANUSIA lewat panel, sesudah sinkronisasi
   * terakhirnya — jadi sinkronisasi tidak boleh menimpanya (docs/13 §6).
   *
   * Barisnya tetap ditampilkan dan tetap bisa dicentang sendiri oleh staff.
   * Yang berubah cuma satu: ia tidak pernah ikut tercentang otomatis. Kalau
   * memang harus dikembalikan ke angka Accurate, itu tindakan yang disengaja —
   * bukan efek samping dari menekan "pilih semua".
   */
  disuntingManusia: boolean
}

export type AccuratePricePreview = {
  configured: boolean
  rows: AccuratePriceRow[]
  ringkasan: {
    totalTerpetakan: number
    cocokDiWeb: number
    hargaBeda: number
    adaPeringatan: number
    disuntingManusia: number
  }
}

/** Baris mentah hasil join penambat `products.accurate_code`. */
type BarisPenambat = {
  kodeAccurate: string
  productId: number
  wooId: number | bigint
  nama: string
  slug: string
  status: string
  regularPrice: string | null
  sp: string | null
}

/** Ambang selisih ekstrem yang layak diperingatkan (kemungkinan salah data). */
const AMBANG_SELISIH_EKSTREM = 50

/**
 * Produk yang harganya terakhir diubah MANUSIA, bukan sinkronisasi.
 *
 * Dibaca dari `product_logs`, tanpa kolom tambahan di `products`: aksinya sudah
 * terpisah sejak awal — `UPDATE_PRICE` saat seseorang mengubah lewat panel,
 * `SYNC_PRICE` saat harga datang dari Accurate. Aturannya karena itu bisa
 * dibaca dari riwayat: kalau `UPDATE_PRICE` terakhir sebuah produk lebih baru
 * daripada `SYNC_PRICE` terakhirnya — atau produk itu belum pernah disinkronkan
 * sama sekali — harganya milik manusia.
 *
 * `product_logs.product_id` menyimpan `wooId`, BUKAN `products.id`. Keliru di
 * sini menghasilkan penandaan yang menunjuk produk acak, dan akibatnya paling
 * buruk justru saat tidak terlihat: sebagian harga dilewati tanpa alasan yang
 * bisa dijelaskan.
 *
 * Satu query untuk semua produk, bukan satu per baris — pratinjau menyandingkan
 * ratusan produk sekaligus, dan bertanya per baris berarti ratusan perjalanan
 * ke database untuk satu layar (§ batas koneksi Hostinger 500/jam).
 */
async function cariHargaMilikManusia(wooIds: number[]): Promise<Set<number>> {
  if (wooIds.length === 0) return new Set()

  const rows = await getPrisma().$queryRawUnsafe<
    { productId: number | bigint; manual: Date | null; sync: Date | null }[]
  >(
    `SELECT product_id AS productId,
            MAX(CASE WHEN action = 'UPDATE_PRICE' THEN created_at END) AS manual,
            MAX(CASE WHEN action = 'SYNC_PRICE'   THEN created_at END) AS sync
     FROM product_logs
     WHERE action IN ('UPDATE_PRICE', 'SYNC_PRICE')
       AND product_id IN (${wooIds.map(() => "?").join(",")})
     GROUP BY product_id`,
    ...wooIds,
  )

  const out = new Set<number>()
  for (const r of rows) {
    if (r.manual === null) continue
    // Belum pernah disinkronkan, atau suntingannya lebih baru — dua-duanya
    // berarti angka yang ada sekarang datang dari manusia.
    if (r.sync === null || r.manual > r.sync) out.add(Number(r.productId))
  }
  return out
}

/**
 * Bangun pratinjau perbandingan harga. READ-ONLY — tidak menulis apa pun.
 */
export async function buildAccuratePricePreview(): Promise<AccuratePricePreview> {
  if (!(await isStockDataAvailable())) {
    return {
      configured: false,
      rows: [],
      ringkasan: {
        totalTerpetakan: 0,
        cocokDiWeb: 0,
        hargaBeda: 0,
        adaPeringatan: 0,
        disuntingManusia: 0,
      },
    }
  }

  const prisma = getPrisma()

  /**
   * Sumbernya kini `products.accurate_code` — penambat tetap yang ditetapkan
   * manusia, bukan lagi `accurate_woo_mapping` yang lahir dari pencocokan
   * kemiripan nama berskor.
   *
   * Bedanya bukan gaya. Pemetaan lama memuat 1.092 baris berskor 100 yang
   * menunjuk `woo_product_id = 0` — produk yang tidak ada. Menurut ukuran yang
   * dipakai kode lama, merekalah pemetaan paling tepercaya di seluruh tabel.
   * Penambat tidak bisa begitu: ia kolom di baris produk yang bersangkutan,
   * jadi "menunjuk produk yang tidak ada" bukan keadaan yang mungkin.
   *
   * JOIN, bukan LEFT JOIN: produk tanpa penambat memang tidak punya harga
   * Accurate untuk dibandingkan, jadi ia bukan baris pratinjau.
   */
  const barisPenambat = await prisma.$queryRawUnsafe<BarisPenambat[]>(
    `SELECT
       p.id            AS productId,
       p.woo_id        AS wooId,
       p.name          AS nama,
       p.slug          AS slug,
       p.status        AS status,
       p.regular_price AS regularPrice,
       p.accurate_code AS kodeAccurate,
       a.\`SP\`         AS sp
     FROM products p
     JOIN accurate_products a ON a.\`Kode Accurate\` = p.accurate_code
     WHERE p.accurate_code IS NOT NULL`,
  )

  const wooIds = barisPenambat.map((b) => Number(b.wooId))
  const pemilikManusia = await cariHargaMilikManusia(wooIds)

  const rows: AccuratePriceRow[] = []
  for (const t of barisPenambat) {
    const web = {
      id: t.productId,
      wooId: Number(t.wooId),
      name: t.nama,
      slug: t.slug,
      status: t.status,
    }

    const hargaWeb = t.regularPrice === null ? null : Number(t.regularPrice)
    const harga = parseHargaAccurate(t.sp) // SP = harga jual → regularPrice

    let selisihPersen: number | null = null
    if (harga.nilai !== null && hargaWeb !== null && hargaWeb > 0) {
      selisihPersen = ((harga.nilai - hargaWeb) / hargaWeb) * 100
    }

    // Susun peringatan (bukan blokir): harga kosong, catatan dari parser, atau
    // selisih ekstrem yang menandakan kemungkinan salah data.
    let peringatan: string | null = null
    if (harga.nilai === null) {
      peringatan = harga.catatan ?? "harga Accurate kosong"
    } else if (harga.catatan) {
      peringatan = harga.catatan
    } else if (
      selisihPersen !== null &&
      Math.abs(selisihPersen) > AMBANG_SELISIH_EKSTREM
    ) {
      peringatan = `selisih ekstrem ${selisihPersen.toFixed(0)}% — cek dulu`
    }

    rows.push({
      kodeAccurate: t.kodeAccurate,
      productId: web.id,
      wooId: web.wooId,
      nama: web.name,
      slug: web.slug,
      status: web.status,
      hargaWebSekarang: hargaWeb,
      hargaAccurate: harga,
      selisihPersen,
      peringatan,
      disuntingManusia: pemilikManusia.has(web.wooId),
    })
  }

  // Urutkan: yang harganya beda & siap diterapkan di atas, lalu yang disunting
  // manusia, lalu yang berperingatan, lalu yang sama. Yang paling butuh
  // keputusan ada di layar pertama; yang tak perlu disentuh mengendap di bawah.
  rows.sort((a, b) => {
    const skor = (r: AccuratePriceRow) => {
      if (r.hargaAccurate.nilai === null) return 4
      if (r.peringatan) return 3
      const beda = r.selisihPersen !== null && Math.abs(r.selisihPersen) > 0.01
      if (!beda) return 2
      return r.disuntingManusia ? 1 : 0
    }
    return skor(a) - skor(b)
  })

  return {
    configured: true,
    rows,
    ringkasan: {
      totalTerpetakan: barisPenambat.length,
      cocokDiWeb: rows.length,
      hargaBeda: rows.filter(
        (r) =>
          r.hargaAccurate.nilai !== null &&
          r.selisihPersen !== null &&
          Math.abs(r.selisihPersen) > 0.01,
      ).length,
      adaPeringatan: rows.filter((r) => r.peringatan !== null).length,
      disuntingManusia: rows.filter((r) => r.disuntingManusia).length,
    },
  }
}
