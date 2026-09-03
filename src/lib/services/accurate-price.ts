import "server-only"

import { getPrisma } from "@/lib/prisma/client"
import {
  ambilHargaAccurateTerpetakan,
  isStockDataAvailable,
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
}

export type AccuratePricePreview = {
  configured: boolean
  rows: AccuratePriceRow[]
  ringkasan: {
    totalTerpetakan: number
    cocokDiWeb: number
    hargaBeda: number
    adaPeringatan: number
  }
}

/** Ambang selisih ekstrem yang layak diperingatkan (kemungkinan salah data). */
const AMBANG_SELISIH_EKSTREM = 50

/**
 * Bangun pratinjau perbandingan harga. READ-ONLY — tidak menulis apa pun.
 */
export async function buildAccuratePricePreview(): Promise<AccuratePricePreview> {
  if (!(await isStockDataAvailable())) {
    return {
      configured: false,
      rows: [],
      ringkasan: { totalTerpetakan: 0, cocokDiWeb: 0, hargaBeda: 0, adaPeringatan: 0 },
    }
  }

  const terpetakan = await ambilHargaAccurateTerpetakan()

  // Ambil produk web yang wooId-nya muncul di peta, sekali jalan.
  const wooIds = [...new Set(terpetakan.map((t) => t.wooProductId))]
  const produkWeb = await getPrisma().product.findMany({
    where: { wooId: { in: wooIds } },
    select: {
      id: true,
      wooId: true,
      name: true,
      slug: true,
      status: true,
      regularPrice: true,
    },
  })
  const webByWooId = new Map(produkWeb.map((p) => [p.wooId, p]))

  const rows: AccuratePriceRow[] = []
  for (const t of terpetakan) {
    const web = webByWooId.get(t.wooProductId)
    if (web === undefined) continue // termapping tapi produknya tak ada di katalog web

    const hargaWeb =
      web.regularPrice === null ? null : Number(web.regularPrice.toString())
    const harga = t.hargaSP // SP = harga jual → regularPrice

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
    })
  }

  // Urutkan: yang harganya beda & tanpa peringatan di atas (paling siap),
  // lalu yang berperingatan, lalu yang sama.
  rows.sort((a, b) => {
    const skor = (r: AccuratePriceRow) => {
      if (r.hargaAccurate.nilai === null) return 3
      if (r.peringatan) return 2
      if (r.selisihPersen !== null && Math.abs(r.selisihPersen) > 0.01) return 0
      return 1
    }
    return skor(a) - skor(b)
  })

  return {
    configured: true,
    rows,
    ringkasan: {
      totalTerpetakan: terpetakan.length,
      cocokDiWeb: rows.length,
      hargaBeda: rows.filter(
        (r) =>
          r.hargaAccurate.nilai !== null &&
          r.selisihPersen !== null &&
          Math.abs(r.selisihPersen) > 0.01,
      ).length,
      adaPeringatan: rows.filter((r) => r.peringatan !== null).length,
    },
  }
}
